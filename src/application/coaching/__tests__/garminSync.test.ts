import { describe, expect, it } from 'vitest'
import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import {
  buildGarminSyncPlan,
  countOperations,
  formatGarminSyncPreview,
  hasGarminMutations,
  selectSyncableWorkouts,
} from '../garminSync'
import { emptyGarminSyncState, garminContentHash, type GarminSyncState } from '../garminSyncState'
import { toGarminWorkoutPayload } from '../garminWorkoutMapping'

const TODAY = '2026-09-06'

function workout(overrides: Partial<WorkoutPrescription> & { id: string; date: string }): WorkoutPrescription {
  return {
    revision: 1,
    type: 'easy',
    title: 'Easy Aerobic Run',
    description: 'Steady easy aerobic run.',
    status: 'prescribed',
    blocks: [{ kind: 'effort', target: { distanceMeters: 6_000, paceSecPerKm: { min: 310, max: 387 } } }],
    provenance: { source: 'gemini', trigger: 'bootstrap', createdAt: '2026-09-05T22:25:08.078Z' },
    ...overrides,
  }
}

function plan(workouts: WorkoutPrescription[], courseAwareRace = true): CoachingPlan {
  return {
    schemaVersion: 1,
    id: 'plan-1',
    revision: 1,
    status: 'active',
    block: { id: 'b', name: 'Block', startDate: '2026-09-06', endDate: '2026-10-03', focus: 'Build' },
    targetEvent: { id: 'primary', name: '10 km', date: '2026-11-29', distanceMeters: 10_000 },
    tuneUpEvents: [
      {
        id: 'tune',
        name: 'Broschtkriibslaf',
        date: '2026-10-03',
        distanceMeters: 5_000,
        ...(courseAwareRace ? { courseContext: { pacingNotes: ['hilly Broscht course with a PacePro strategy'] } } : {}),
      },
    ],
    goal: { kind: 'time', targetSeconds: 2_400, description: 'Sub 40' },
    weeks: [
      { id: 'w1', index: 1, startDate: '2026-09-06', endDate: '2026-09-13', focus: 'Build', workouts },
    ],
    provenance: { source: 'gemini', trigger: 'bootstrap', createdAt: '2026-09-05T22:25:08.078Z' },
  }
}

function syncedState(entries: { id: string; date: string; workout: WorkoutPrescription }[]): GarminSyncState {
  return {
    schemaVersion: 1,
    planId: 'plan-1',
    updatedAt: '2026-09-06T10:00:00.000Z',
    entries: entries.map((entry, index) => ({
      prescriptionId: entry.id,
      date: entry.date,
      contentHash: garminContentHash(toGarminWorkoutPayload(entry.workout), entry.date),
      garminWorkoutId: `900${index}`,
      garminWorkoutScheduleId: `800${index}`,
      status: 'scheduled' as const,
      lastSyncedAt: '2026-09-06T10:00:00.000Z',
    })),
  }
}

const build = (coachingPlan: CoachingPlan, state: GarminSyncState | null, evaluations: WorkoutEvaluation[] = []) =>
  buildGarminSyncPlan(coachingPlan, evaluations, state, { today: TODAY })

describe('first sync', () => {
  it('creates every future prescription', () => {
    const workouts = [workout({ id: 'a', date: '2026-09-08' }), workout({ id: 'b', date: '2026-09-09' })]

    const operations = build(plan(workouts), null).operations

    expect(operations.map((operation) => [operation.action, operation.date])).toEqual([
      ['create', '2026-09-08'],
      ['create', '2026-09-09'],
    ])
    expect(countOperations(operations)).toEqual({ create: 2, update: 0, delete: 0, keep: 0, skip: 0 })
  })

  it('carries the Garmin payload on every create', () => {
    const operations = build(plan([workout({ id: 'a', date: '2026-09-08' })]), null).operations

    expect(operations[0]!.payload?.workoutName).toBe('Easy Aerobic Run')
    expect(operations[0]!.contentHash).toBeTruthy()
  })
})

describe('idempotency', () => {
  it('reports an unchanged second run as KEEP, not as a skip', () => {
    const workouts = [workout({ id: 'a', date: '2026-09-08' }), workout({ id: 'b', date: '2026-09-09' })]
    const state = syncedState(workouts.map((each) => ({ id: each.id, date: each.date, workout: each })))

    const operations = build(plan(workouts), state).operations

    expect(operations.every((operation) => operation.action === 'keep')).toBe(true)
    expect(countOperations(operations)).toEqual({ create: 0, update: 0, delete: 0, keep: 2, skip: 0 })
    expect(hasGarminMutations(countOperations(operations))).toBe(false)
  })

  it('computes the same fingerprint for the same inputs', () => {
    const workouts = [workout({ id: 'a', date: '2026-09-08' })]

    expect(build(plan(workouts), null).fingerprint).toBe(build(plan(workouts), null).fingerprint)
  })

  it('changes the fingerprint when an operation changes', () => {
    const before = build(plan([workout({ id: 'a', date: '2026-09-08' })]), null)
    const after = build(plan([workout({ id: 'a', date: '2026-09-08', title: 'Renamed' })]), null)

    expect(after.fingerprint).not.toBe(before.fingerprint)
  })
})

describe('changed prescriptions', () => {
  it('replaces rather than duplicates when the content changed', () => {
    const before = workout({ id: 'a', date: '2026-09-08' })
    const after = workout({
      id: 'a',
      date: '2026-09-08',
      blocks: [{ kind: 'effort', target: { distanceMeters: 9_000, paceSecPerKm: { min: 310, max: 387 } } }],
    })
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: before }])

    const operations = build(plan([after]), state).operations

    expect(operations).toHaveLength(1)
    expect(operations[0]!.action).toBe('replace')
    expect(operations[0]!.existing?.garminWorkoutId).toBe('9000')
    expect(countOperations(operations)).toEqual({ create: 0, update: 1, delete: 0, keep: 0, skip: 0 })
  })

  it('replaces on the new date when a prescription moved', () => {
    const before = workout({ id: 'a', date: '2026-09-08' })
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: before }])

    const operations = build(plan([workout({ id: 'a', date: '2026-09-10' })]), state).operations

    expect(operations[0]!.action).toBe('replace')
    expect(operations[0]!.date).toBe('2026-09-10')
    expect(operations[0]!.reason).toContain('moved from 2026-09-08')
  })

  it('ignores a revision bump that does not change the Garmin payload', () => {
    const before = workout({ id: 'a', date: '2026-09-08' })
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: before }])

    const operations = build(plan([workout({ id: 'a', date: '2026-09-08', revision: 7 })]), state).operations

    expect(operations[0]!.action).toBe('keep')
  })
})

describe('removed prescriptions', () => {
  it('deletes a future entry whose prescription left the plan', () => {
    const removed = workout({ id: 'gone', date: '2026-09-09' })
    const kept = workout({ id: 'a', date: '2026-09-08' })
    const state = syncedState([
      { id: 'a', date: '2026-09-08', workout: kept },
      { id: 'gone', date: '2026-09-09', workout: removed },
    ])

    const operations = build(plan([kept]), state).operations

    expect(operations.filter((operation) => operation.action === 'delete')).toHaveLength(1)
    expect(operations.find((operation) => operation.action === 'delete')?.existing?.garminWorkoutId).toBe('9001')
  })

  it('never deletes outside the requested window', () => {
    // `--to` reads as "only push up to this date". It used to mean "push up to
    // this date and wipe everything after it": the window filtered the
    // prescriptions that counted as synced, but not the mapping entries
    // considered for deletion, so every already-pushed workout beyond `to`
    // looked like one that had left the plan.
    const inside = workout({ id: 'a', date: '2026-09-08' })
    const beyond = workout({ id: 'b', date: '2026-09-15' })
    const state = syncedState([
      { id: 'a', date: '2026-09-08', workout: inside },
      { id: 'b', date: '2026-09-15', workout: beyond },
    ])

    const operations = buildGarminSyncPlan(plan([inside, beyond]), [], state, {
      today: TODAY,
      to: '2026-09-12',
    }).operations

    expect(operations.filter((operation) => operation.action === 'delete')).toEqual([])
    expect(operations.map((operation) => operation.date)).toEqual(['2026-09-08'])
  })

  it('never deletes before the requested window either', () => {
    const early = workout({ id: 'a', date: '2026-09-08' })
    const late = workout({ id: 'b', date: '2026-09-15' })
    const state = syncedState([
      { id: 'a', date: '2026-09-08', workout: early },
      { id: 'b', date: '2026-09-15', workout: late },
    ])

    const operations = buildGarminSyncPlan(plan([early, late]), [], state, {
      today: TODAY,
      from: '2026-09-14',
    }).operations

    expect(operations.filter((operation) => operation.action === 'delete')).toEqual([])
  })

  it('still deletes inside the window when the prescription really is gone', () => {
    const kept = workout({ id: 'a', date: '2026-09-08' })
    const removed = workout({ id: 'gone', date: '2026-09-09' })
    const state = syncedState([
      { id: 'a', date: '2026-09-08', workout: kept },
      { id: 'gone', date: '2026-09-09', workout: removed },
    ])

    const operations = buildGarminSyncPlan(plan([kept]), [], state, { today: TODAY, to: '2026-09-12' }).operations

    expect(operations.filter((operation) => operation.action === 'delete').map((o) => o.date)).toEqual([
      '2026-09-09',
    ])
  })

  it('deletes a cancelled prescription that is still in the plan', () => {
    const cancelled = workout({ id: 'a', date: '2026-09-08', status: 'cancelled' })
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: workout({ id: 'a', date: '2026-09-08' }) }])

    const operations = build(plan([cancelled]), state).operations

    expect(operations.map((operation) => operation.action)).toEqual(['delete'])
  })
})

describe('never touching what RunOmics does not own', () => {
  it('emits no operation for a Garmin workout absent from the mapping', () => {
    const operations = build(plan([workout({ id: 'a', date: '2026-09-08' })]), emptyGarminSyncState()).operations

    expect(operations.every((operation) => operation.existing === null)).toBe(true)
    expect(operations.every((operation) => operation.action === 'create')).toBe(true)
  })

  it('reuses no mapping written for a different plan', () => {
    const state = { ...syncedState([{ id: 'a', date: '2026-09-08', workout: workout({ id: 'a', date: '2026-09-08' }) }]), planId: 'other-plan' }

    const operations = build(plan([workout({ id: 'a', date: '2026-09-08' })]), state).operations

    expect(operations.find((operation) => operation.prescriptionId === 'a')?.action).toBe('create')
  })
})

describe('selecting what is syncable', () => {
  const evaluation = (prescriptionId: string, matchStatus = 'matched') =>
    ({ prescriptionId, matchStatus }) as unknown as WorkoutEvaluation

  const source = plan([
    workout({ id: 'past', date: '2026-09-01' }),
    workout({ id: 'cancelled', date: '2026-09-16', status: 'cancelled' }),
    workout({ id: 'done', date: '2026-09-12' }),
    workout({ id: 'later', date: '2026-09-15' }),
    workout({ id: 'soon', date: '2026-09-08' }),
  ])

  it('keeps only future prescribed and adjusted sessions, in chronological order', () => {
    const selected = selectSyncableWorkouts(source, [evaluation('done')], { today: TODAY })

    expect(selected.map((each) => each.date)).toEqual(['2026-09-08', '2026-09-15'])
  })

  it('ignores an unmatched evaluation, so a date-only guess never drops a session', () => {
    const selected = selectSyncableWorkouts(source, [evaluation('done', 'date_only')], { today: TODAY })

    expect(selected.map((each) => each.id)).toContain('done')
  })

  it('applies from and to, and never reaches back before today', () => {
    const dates = (window: Parameters<typeof selectSyncableWorkouts>[2]) =>
      selectSyncableWorkouts(source, [], window).map((each) => each.date)

    expect(dates({ today: TODAY, from: '2026-09-15' })).toEqual(['2026-09-15'])
    expect(dates({ today: TODAY, to: '2026-09-12' })).toEqual(['2026-09-08', '2026-09-12'])
    expect(dates({ today: TODAY, from: '2026-01-01' })).toEqual(['2026-09-08', '2026-09-12', '2026-09-15'])
  })
})

describe('history', () => {
  it('never syncs a past prescription', () => {
    const operations = build(plan([workout({ id: 'past', date: '2026-09-01' })]), null).operations

    expect(operations).toHaveLength(0)
  })

  it('never deletes a mapping entry dated in the past', () => {
    const past = workout({ id: 'past', date: '2026-08-30' })
    const state = syncedState([{ id: 'past', date: '2026-08-30', workout: past }])

    const operations = build(plan([]), state).operations

    expect(operations).toHaveLength(0)
  })

  it('never syncs a completed prescription', () => {
    const done = workout({ id: 'done', date: '2026-09-08' })
    const evaluations = [
      { prescriptionId: 'done', matchStatus: 'matched' } as unknown as WorkoutEvaluation,
    ]

    const operations = build(plan([done]), null, evaluations).operations

    expect(operations).toHaveLength(0)
  })
})

describe('course-aware races', () => {
  const race = workout({
    id: 'race',
    date: '2026-10-03',
    type: 'race',
    title: 'Broschtkriibslaf 5K Race',
    blocks: [
      { kind: 'warmup', target: { distanceMeters: 2_000, paceSecPerKm: { min: 310, max: 387 } } },
      { kind: 'effort', target: { distanceMeters: 5_000 }, notes: ['Follow the PacePro strategy.'] },
      { kind: 'cooldown', target: { distanceMeters: 2_000, paceSecPerKm: { min: 310, max: 387 } } },
    ],
  })

  const raceOperation = (operations: ReturnType<typeof build>['operations']) =>
    operations.find((operation) => operation.prescriptionId === 'race')

  const syncingRaces = (coachingPlan: ReturnType<typeof plan>) =>
    buildGarminSyncPlan(coachingPlan, [], null, { today: TODAY }, { syncRaces: true }).operations

  it('skips the race, because Garmin already carries it as a calendar event', () => {
    const operations = build(plan([workout({ id: 'a', date: '2026-09-08' }), race]), null).operations

    expect(raceOperation(operations)?.action).toBe('skip')
    expect(raceOperation(operations)?.reason).toBe(
      'Course-aware race already on Garmin calendar - use Garmin PacePro',
    )
    expect(raceOperation(operations)?.payload).toBeNull()
    expect(countOperations(operations)).toEqual({ create: 1, update: 0, delete: 0, keep: 0, skip: 1 })
  })

  it('skips a race with no course context for the same reason', () => {
    const operations = build(plan([race], false), null).operations

    expect(raceOperation(operations)?.action).toBe('skip')
    expect(raceOperation(operations)?.reason).toBe('Race already on the Garmin calendar')
  })

  it('never leaves a race out of the sync silently', () => {
    const operations = build(plan([race]), null).operations

    expect(operations).toHaveLength(1)
    expect(raceOperation(operations)?.reason).toBeTruthy()
  })

  describe('when races are explicitly synced', () => {
    it('sends the race effort with no pace target so PacePro owns the pacing', () => {
      const steps = raceOperation(syncingRaces(plan([race])))?.payload?.workoutSegments[0]!.workoutSteps

      const effort = steps?.[1] as { targetType: { workoutTargetTypeKey: string }; endConditionValue: number | null }
      expect(effort.endConditionValue).toBe(5_000)
      expect(effort.targetType.workoutTargetTypeKey).toBe('no.target')
    })

    it('keeps the warmup and cooldown paced, which PacePro does not cover', () => {
      const steps = raceOperation(syncingRaces(plan([race])))?.payload?.workoutSegments[0]!.workoutSteps

      const warmup = steps?.[0] as { targetType: { workoutTargetTypeKey: string } }
      const cooldown = steps?.[2] as { targetType: { workoutTargetTypeKey: string } }
      expect(warmup.targetType.workoutTargetTypeKey).toBe('pace.zone')
      expect(cooldown.targetType.workoutTargetTypeKey).toBe('pace.zone')
    })

    it('strips a pace target a future plan revision put on the race effort', () => {
      const paced = workout({
        ...race,
        blocks: [{ kind: 'effort', target: { distanceMeters: 5_000, paceSecPerKm: { min: 235, max: 245 } } }],
      })
      const effort = raceOperation(syncingRaces(plan([paced])))?.payload?.workoutSegments[0]!.workoutSteps[0] as {
        targetType: { workoutTargetTypeKey: string }
      }

      expect(effort.targetType.workoutTargetTypeKey).toBe('no.target')
    })
  })
})

describe('partial failure recovery', () => {
  it('retries only the schedule when the workout already exists on Garmin', () => {
    const prescribed = workout({ id: 'a', date: '2026-09-08' })
    const state: GarminSyncState = {
      ...syncedState([{ id: 'a', date: '2026-09-08', workout: prescribed }]),
      entries: [
        {
          prescriptionId: 'a',
          date: '2026-09-08',
          contentHash: garminContentHash(toGarminWorkoutPayload(prescribed), '2026-09-08'),
          garminWorkoutId: '9000',
          garminWorkoutScheduleId: null,
          status: 'workout_created',
          lastSyncedAt: '2026-09-06T10:00:00.000Z',
        },
      ],
    }

    const operations = build(plan([prescribed]), state).operations

    expect(operations[0]!.action).toBe('schedule')
    expect(operations[0]!.existing?.garminWorkoutId).toBe('9000')
    expect(countOperations(operations)).toEqual({ create: 1, update: 0, delete: 0, keep: 0, skip: 0 })
  })
})

describe('preview rendering', () => {
  const race = workout({ id: 'race', date: '2026-10-03', type: 'race', title: 'Broschtkriibslaf 5K Race' })
  const easy = workout({ id: 'a', date: '2026-09-08', title: 'Aerobic Easy Run' })

  it('lists every mutation and puts a reason on its own line', () => {
    const preview = formatGarminSyncPreview(build(plan([easy, race]), null))

    expect(preview).toContain('Garmin sync preview')
    expect(preview).toContain('CREATE  2026-09-08  Aerobic Easy Run')
    expect(preview).toContain('SKIP    2026-10-03  Broschtkriibslaf 5K Race')
    expect(preview).toContain('\n        Course-aware race already on Garmin calendar - use Garmin PacePro')
  })

  it('distinguishes a kept workout from a skipped one', () => {
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: easy }])

    const preview = formatGarminSyncPreview(build(plan([easy, race]), state))

    expect(preview).toContain('KEEP    2026-09-08  Aerobic Easy Run')
    expect(preview).toContain('SKIP    2026-10-03  Broschtkriibslaf 5K Race')
    expect(preview).toContain('Create: 0')
    expect(preview).toContain('Update: 0')
    expect(preview).toContain('Delete: 0')
    expect(preview).toContain('Keep: 1')
    expect(preview).toContain('Skip: 1')
  })

  it('never labels a kept workout with a reason', () => {
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: easy }])

    const preview = formatGarminSyncPreview(build(plan([easy]), state))

    expect(preview).toContain('KEEP    2026-09-08  Aerobic Easy Run')
    expect(preview.split('\n').filter((line) => line.startsWith('        '))).toEqual([])
  })

  it('renders identically for identical inputs', () => {
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: easy }])

    expect(formatGarminSyncPreview(build(plan([easy, race]), state))).toBe(
      formatGarminSyncPreview(build(plan([easy, race]), state)),
    )
  })
})

describe('mutation detection', () => {
  const easyRun = workout({ id: 'a', date: '2026-09-08' })
  const raceRun = workout({ id: 'race', date: '2026-10-03', type: 'race', title: 'Broschtkriibslaf 5K Race' })
  const synced = syncedState([{ id: 'a', date: '2026-09-08', workout: easyRun }])

  it('reports no mutation when everything is kept or skipped', () => {
    const operations = build(plan([easyRun, raceRun]), synced).operations

    expect(hasGarminMutations(countOperations(operations))).toBe(false)
  })

  it('reports a mutation for a create', () => {
    const operations = build(plan([workout({ id: 'new', date: '2026-09-09' })]), null).operations

    expect(hasGarminMutations(countOperations(operations))).toBe(true)
  })

  it('reports a mutation for a delete', () => {
    const operations = build(plan([]), synced).operations

    expect(hasGarminMutations(countOperations(operations))).toBe(true)
  })
})
