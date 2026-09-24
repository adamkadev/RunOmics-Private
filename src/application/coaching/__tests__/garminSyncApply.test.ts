import { describe, expect, it } from 'vitest'
import { GarminRateLimitError, type GarminWorkoutGateway } from '@/application/ports/GarminWorkoutGateway'
import type { CoachingPlan, WorkoutPrescription } from '@/domain/coaching/types'
import { buildGarminSyncPlan } from '../garminSync'
import { applyGarminSyncPlan, formatGarminSyncResults, verifyGarminSync } from '../garminSyncApply'
import { garminContentHash, type GarminSyncState } from '../garminSyncState'
import { toGarminWorkoutPayload, type GarminWorkoutPayload } from '../garminWorkoutMapping'

const TODAY = '2026-09-06'
const NOW = '2026-09-06T12:00:00.000Z'

function workout(overrides: Partial<WorkoutPrescription> & { id: string; date: string }): WorkoutPrescription {
  return {
    revision: 1,
    type: 'easy',
    title: 'Easy Aerobic Run',
    description: 'Steady easy aerobic run.',
    status: 'prescribed',
    blocks: [{ kind: 'effort', target: { distanceMeters: 6_000 } }],
    provenance: { source: 'gemini', trigger: 'bootstrap', createdAt: '2026-09-05T22:25:08.078Z' },
    ...overrides,
  }
}

function plan(workouts: WorkoutPrescription[]): CoachingPlan {
  return {
    schemaVersion: 1,
    id: 'plan-1',
    revision: 1,
    status: 'active',
    block: { id: 'b', name: 'Block', startDate: '2026-09-06', endDate: '2026-10-03', focus: 'Build' },
    targetEvent: { id: 'primary', name: '10 km', date: '2026-11-29', distanceMeters: 10_000 },
    goal: { kind: 'time', targetSeconds: 2_400, description: 'Sub 40' },
    weeks: [{ id: 'w1', index: 1, startDate: '2026-09-06', endDate: '2026-09-13', focus: 'Build', workouts }],
    provenance: { source: 'gemini', trigger: 'bootstrap', createdAt: '2026-09-05T22:25:08.078Z' },
  }
}

class FakeGarmin implements GarminWorkoutGateway {
  readonly created: GarminWorkoutPayload[] = []
  readonly scheduled: [string, string][] = []
  readonly unscheduled: string[] = []
  readonly deleted: string[] = []
  private nextId = 1
  readonly foreign = new Map<string, string>([['555', 'My own tempo workout']])
  private readonly library = new Map<string, string>()
  private readonly calendar = new Map<string, { scheduleId: string; date: string }>()

  constructor(private readonly failures: { schedule?: boolean; create?: boolean; rateLimitAfter?: number } = {}) {}

  async createWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }> {
    if (this.failures.rateLimitAfter !== undefined && this.created.length >= this.failures.rateLimitAfter) {
      throw new GarminRateLimitError()
    }
    if (this.failures.create) throw new Error('HTTP 500 from workout-service')
    this.created.push(payload)
    const workoutId = `100${this.nextId++}`
    this.library.set(workoutId, payload.workoutName)
    return { workoutId }
  }

  async scheduleWorkout(workoutId: string, date: string): Promise<{ workoutScheduleId: string }> {
    if (this.failures.schedule) throw new Error('HTTP 500 from schedule')
    const workoutScheduleId = `200${this.nextId++}`
    this.scheduled.push([workoutId, date])
    this.calendar.set(workoutId, { scheduleId: workoutScheduleId, date })
    return { workoutScheduleId }
  }

  async unscheduleWorkout(scheduleId: string): Promise<void> {
    this.unscheduled.push(scheduleId)
    for (const [workoutId, entry] of this.calendar) if (entry.scheduleId === scheduleId) this.calendar.delete(workoutId)
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    this.deleted.push(workoutId)
    this.library.delete(workoutId)
  }

  async getWorkout(workoutId: string): Promise<{ workoutId: string; workoutName: string } | null> {
    const name = this.library.get(workoutId) ?? this.foreign.get(workoutId)
    return name ? { workoutId, workoutName: name } : null
  }

  async getScheduledWorkouts(): Promise<{ scheduleId: string; workoutId: string; date: string }[]> {
    return [...this.calendar.entries()].map(([workoutId, entry]) => ({ workoutId, ...entry }))
  }
}

const apply = (syncPlan: ReturnType<typeof buildGarminSyncPlan>, state: GarminSyncState | null, gateway: FakeGarmin) =>
  applyGarminSyncPlan(syncPlan, state, gateway, { now: () => NOW, persist: () => {} })

const build = (coachingPlan: CoachingPlan, state: GarminSyncState | null) =>
  buildGarminSyncPlan(coachingPlan, [], state, { today: TODAY })

function syncedState(entries: { workout: WorkoutPrescription; workoutId: string; scheduleId: string }[]): GarminSyncState {
  return {
    schemaVersion: 1,
    planId: 'plan-1',
    updatedAt: NOW,
    entries: entries.map((entry) => ({
      prescriptionId: entry.workout.id,
      date: entry.workout.date,
      contentHash: garminContentHash(toGarminWorkoutPayload(entry.workout), entry.workout.date),
      garminWorkoutId: entry.workoutId,
      garminWorkoutScheduleId: entry.scheduleId,
      status: 'scheduled' as const,
      lastSyncedAt: NOW,
    })),
  }
}

describe('applying a first sync', () => {
  it('creates then schedules each workout and records both ids', async () => {
    const gateway = new FakeGarmin()
    const workouts = [workout({ id: 'a', date: '2026-09-08' }), workout({ id: 'b', date: '2026-09-09' })]

    const report = await apply(build(plan(workouts), null), null, gateway)

    expect(gateway.created).toHaveLength(2)
    expect(gateway.scheduled.map(([, date]) => date)).toEqual(['2026-09-08', '2026-09-09'])
    expect(gateway.deleted).toEqual([])
    expect(report.state.entries.map((entry) => entry.status)).toEqual(['scheduled', 'scheduled'])
    expect(report.state.entries[0]!.garminWorkoutScheduleId).toBeTruthy()
    expect(report.state.planId).toBe('plan-1')
  })

  it('is idempotent: replaying against the resulting state writes nothing', async () => {
    const gateway = new FakeGarmin()
    const workouts = [workout({ id: 'a', date: '2026-09-08' })]
    const first = await apply(build(plan(workouts), null), null, gateway)

    const second = await apply(build(plan(workouts), first.state), first.state, gateway)

    expect(gateway.created).toHaveLength(1)
    expect(gateway.scheduled).toHaveLength(1)
    expect(second.results.every((result) => result.outcome === 'skipped')).toBe(true)
    expect(second.results.every((result) => result.operation.action === 'keep')).toBe(true)
  })
})

describe('partial failure', () => {
  it('records the created workout when scheduling fails', async () => {
    const gateway = new FakeGarmin({ schedule: true })

    const report = await apply(build(plan([workout({ id: 'a', date: '2026-09-08' })]), null), null, gateway)

    expect(report.results[0]!.outcome).toBe('failed')
    expect(report.results[0]!.error).toContain('Workout created but scheduling failed')
    expect(report.state.entries[0]!.status).toBe('workout_created')
    expect(report.state.entries[0]!.garminWorkoutId).toBe('1001')
  })

  it('retries only the schedule on the next run, creating no duplicate', async () => {
    const workouts = [workout({ id: 'a', date: '2026-09-08' })]
    const failing = new FakeGarmin({ schedule: true })
    const partial = await apply(build(plan(workouts), null), null, failing)

    const gateway = new FakeGarmin()
    const report = await apply(build(plan(workouts), partial.state), partial.state, gateway)

    expect(gateway.created).toHaveLength(0)
    expect(gateway.scheduled).toEqual([['1001', '2026-09-08']])
    expect(report.state.entries[0]!.status).toBe('scheduled')
  })

  it('pushes the new content when the prescription changed after a failed schedule', async () => {
    const before = workout({ id: 'a', date: '2026-09-08' })
    const partial = await apply(build(plan([before]), null), null, new FakeGarmin({ schedule: true }))
    const after = workout({ id: 'a', date: '2026-09-08', title: 'Longer Easy Run' })
    const gateway = new FakeGarmin()

    const report = await apply(build(plan([after]), partial.state), partial.state, gateway)

    expect(gateway.deleted).toEqual(['1001'])
    expect(gateway.created.map((payload) => payload.workoutName)).toEqual(['Longer Easy Run'])
    expect(report.state.entries).toEqual([
      expect.objectContaining({
        status: 'scheduled',
        contentHash: garminContentHash(toGarminWorkoutPayload(after), after.date),
      }),
    ])
  })

  it('reports a create failure without recording a mapping entry', async () => {
    const gateway = new FakeGarmin({ create: true })

    const report = await apply(build(plan([workout({ id: 'a', date: '2026-09-08' })]), null), null, gateway)

    expect(report.results[0]!.outcome).toBe('failed')
    expect(report.results[0]!.error).toContain('HTTP 500')
    expect(report.state.entries).toEqual([])
  })
})

describe('rate limiting', () => {
  it('stops the run instead of continuing through a 429', async () => {
    const gateway = new FakeGarmin({ rateLimitAfter: 1 })
    const workouts = [
      workout({ id: 'a', date: '2026-09-08' }),
      workout({ id: 'b', date: '2026-09-09' }),
      workout({ id: 'c', date: '2026-09-10' }),
    ]

    const report = await apply(build(plan(workouts), null), null, gateway)

    expect(gateway.created).toHaveLength(1)
    expect(report.rateLimited).toBe(true)
    expect(report.results).toHaveLength(2)
    expect(report.results[1]!.outcome).toBe('failed')
    expect(report.state.entries).toHaveLength(1)
  })
})

describe('replacing and deleting', () => {
  it('removes the old Garmin workout before creating the new one', async () => {
    const before = workout({ id: 'a', date: '2026-09-08' })
    const state = syncedState([{ workout: before, workoutId: '9000', scheduleId: '8000' }])
    const after = workout({ id: 'a', date: '2026-09-08', title: 'Longer Easy Run' })
    const gateway = new FakeGarmin()

    const report = await apply(build(plan([after]), state), state, gateway)

    expect(gateway.unscheduled).toEqual(['8000'])
    expect(gateway.deleted).toEqual(['9000'])
    expect(gateway.created).toHaveLength(1)
    expect(report.state.entries).toHaveLength(1)
    expect(report.state.entries[0]!.garminWorkoutId).toBe('1001')
  })

  it('deletes only the entry whose prescription left the plan', async () => {
    const kept = workout({ id: 'a', date: '2026-09-08' })
    const removed = workout({ id: 'gone', date: '2026-09-09' })
    const state = syncedState([
      { workout: kept, workoutId: '9000', scheduleId: '8000' },
      { workout: removed, workoutId: '9001', scheduleId: '8001' },
    ])
    const gateway = new FakeGarmin()

    const report = await apply(build(plan([kept]), state), state, gateway)

    expect(gateway.deleted).toEqual(['9001'])
    expect(gateway.unscheduled).toEqual(['8001'])
    expect(report.state.entries.map((entry) => entry.prescriptionId)).toEqual(['a'])
  })

  it('never names a Garmin workout that is not in the mapping', async () => {
    const kept = workout({ id: 'a', date: '2026-09-08' })
    const state = syncedState([{ workout: kept, workoutId: '9000', scheduleId: '8000' }])
    const gateway = new FakeGarmin()

    await apply(build(plan([kept, workout({ id: 'b', date: '2026-09-09' })]), state), state, gateway)

    expect(gateway.deleted).not.toContain('555')
    expect(gateway.unscheduled).not.toContain('555')
    expect(gateway.deleted).toEqual([])
  })
})

describe('verification', () => {
  it('marks each created workout verified once Garmin shows it on the right date', async () => {
    const gateway = new FakeGarmin()
    const applied = await apply(build(plan([workout({ id: 'a', date: '2026-09-08' })]), null), null, gateway)

    const verified = await verifyGarminSync(applied, gateway)

    expect(verified.results[0]!.verified).toBe(true)
    expect(verified.results[0]!.outcome).toBe('applied')
  })

  it('fails a workout Garmin no longer has', async () => {
    const gateway = new FakeGarmin()
    const applied = await apply(build(plan([workout({ id: 'a', date: '2026-09-08' })]), null), null, gateway)
    await gateway.deleteWorkout(applied.results[0]!.garminWorkoutId as string)

    const verified = await verifyGarminSync(applied, gateway)

    expect(verified.results[0]!.outcome).toBe('failed')
    expect(verified.results[0]!.error).toContain('not found on Garmin')
  })
})

describe('result rendering', () => {
  const race = workout({
    id: 'race',
    date: '2026-10-03',
    type: 'race',
    title: 'Broschtkriibslaf 5K Race',
    blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
  })

  function courseAwarePlan(): CoachingPlan {
    const coachingPlan = plan([workout({ id: 'a', date: '2026-09-08', title: 'Aerobic Easy Run' }), race])
    coachingPlan.tuneUpEvents = [
      { id: 'tune', name: 'Broschtkriibslaf', date: '2026-10-03', distanceMeters: 5_000, courseContext: { pacingNotes: ['hilly'] } },
    ]
    return coachingPlan
  }

  it('marks each line and counts the failures', async () => {
    const gateway = new FakeGarmin()
    const report = await verifyGarminSync(await apply(build(courseAwarePlan(), null), null, gateway), gateway)

    const output = formatGarminSyncResults(report)

    expect(output).toContain('CREATE ✓ 2026-09-08 Aerobic Easy Run')
    expect(output).toContain(
      'SKIP   - 2026-10-03 Broschtkriibslaf 5K Race (Course-aware race already on Garmin calendar - use Garmin PacePro)',
    )
    expect(output).toContain('1 Garmin workout(s) synchronized.')
    expect(output).toContain('0 failure(s).')
  })

  it('creates nothing on the race date, so the calendar event stands alone', async () => {
    const gateway = new FakeGarmin()

    await apply(build(courseAwarePlan(), null), null, gateway)

    expect(gateway.scheduled.map(([, date]) => date)).toEqual(['2026-09-08'])
  })

  it('renders the race as a create when races are explicitly synced', async () => {
    const syncPlan = buildGarminSyncPlan(courseAwarePlan(), [], null, { today: TODAY }, { syncRaces: true })
    const gateway = new FakeGarmin()

    const output = formatGarminSyncResults(await apply(syncPlan, null, gateway))

    expect(output).toContain('CREATE ✓ 2026-10-03 Broschtkriibslaf 5K Race')
    expect(output).toContain('2 Garmin workout(s) synchronized.')
  })
})

describe('crash safety', () => {
  it('records every workout as it is pushed, not once at the end', async () => {
    // A run killed mid-loop used to leave no trace of what Garmin had accepted,
    // so the next --apply created duplicates RunOmics could no longer delete.
    const workouts = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map((date, i) =>
      workout({ id: `w${i}`, date })
    )
    const gateway = new FakeGarmin()
    const checkpoints: GarminSyncState[] = []

    await applyGarminSyncPlan(build(plan(workouts), null), null, gateway, {
      now: () => NOW,
      persist: (state) => checkpoints.push(structuredClone(state)),
    })

    expect(checkpoints).toHaveLength(4)
    expect(checkpoints.map((state) => state.entries.length)).toEqual([1, 2, 3, 4])
  })

  it('keeps the workouts that got through when a later one kills the run', async () => {
    const workouts = ['2026-09-08', '2026-09-09', '2026-09-10'].map((date, i) => workout({ id: `w${i}`, date }))
    const gateway = new FakeGarmin({ rateLimitAfter: 2 })
    let latest: GarminSyncState | null = null

    await applyGarminSyncPlan(build(plan(workouts), null), null, gateway, {
      now: () => NOW,
      persist: (state) => {
        latest = state
      },
    })

    expect(latest).not.toBeNull()
    expect(latest!.entries.map((entry) => entry.prescriptionId)).toEqual(['w0', 'w1'])
  })

  it('still returns the same final state it always did', async () => {
    const workouts = [workout({ id: 'w0', date: '2026-09-08' }), workout({ id: 'w1', date: '2026-09-09' })]
    const gateway = new FakeGarmin()
    const checkpoints: GarminSyncState[] = []

    const report = await applyGarminSyncPlan(build(plan(workouts), null), null, gateway, {
      now: () => NOW,
      persist: (state) => checkpoints.push(structuredClone(state)),
    })

    expect(report.state.entries).toEqual(checkpoints.at(-1)!.entries)
  })

})
