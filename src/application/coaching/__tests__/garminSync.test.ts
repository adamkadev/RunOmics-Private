import { describe, expect, it } from 'vitest'
import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import { buildGarminSyncPlan, countOperations, formatGarminSyncPreview } from '../garminSync'
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
    expect(countOperations(operations)).toEqual({ create: 2, update: 0, delete: 0, skip: 0 })
  })

  it('carries the Garmin payload on every create', () => {
    const operations = build(plan([workout({ id: 'a', date: '2026-09-08' })]), null).operations

    expect(operations[0]!.payload?.workoutName).toBe('Easy Aerobic Run')
    expect(operations[0]!.contentHash).toBeTruthy()
  })
})

describe('idempotency', () => {
  it('makes no Garmin mutation on a second unchanged run', () => {
    const workouts = [workout({ id: 'a', date: '2026-09-08' }), workout({ id: 'b', date: '2026-09-09' })]
    const state = syncedState(workouts.map((each) => ({ id: each.id, date: each.date, workout: each })))

    const operations = build(plan(workouts), state).operations

    expect(operations.every((operation) => operation.action === 'skip')).toBe(true)
    expect(countOperations(operations)).toEqual({ create: 0, update: 0, delete: 0, skip: 2 })
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
    expect(countOperations(operations)).toEqual({ create: 0, update: 1, delete: 0, skip: 0 })
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

    expect(operations[0]!.action).toBe('skip')
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

  it('deletes a cancelled prescription that is still in the plan', () => {
    const cancelled = workout({ id: 'a', date: '2026-09-08', status: 'cancelled' })
    const state = syncedState([{ id: 'a', date: '2026-09-08', workout: workout({ id: 'a', date: '2026-09-08' }) }])

    const operations = build(plan([cancelled]), state).operations

    expect(operations.map((operation) => operation.action)).toEqual(['delete'])
  })
})

describe('never touching what RunOmics does not own', () => {
  it('emits no operation for a Garmin workout absent from the mapping', () => {
    // An unrelated Garmin workout simply has no entry here, so nothing can name it.
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
    blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
  })

  it('skips the race and says why', () => {
    const operations = build(plan([workout({ id: 'a', date: '2026-09-08' }), race]), null).operations
    const skipped = operations.find((operation) => operation.prescriptionId === 'race')

    expect(skipped?.action).toBe('skip')
    expect(skipped?.reason).toBe('Course-aware race - use Garmin PacePro')
    expect(skipped?.payload).toBeNull()
    expect(countOperations(operations)).toEqual({ create: 1, update: 0, delete: 0, skip: 1 })
  })

  it('syncs a race with no course context like any other session', () => {
    const operations = build(plan([race], false), null).operations

    expect(operations[0]!.action).toBe('create')
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
    // The retry counts as finishing the create, never as a second workout.
    expect(countOperations(operations)).toEqual({ create: 1, update: 0, delete: 0, skip: 0 })
  })
})

describe('preview rendering', () => {
  it('lists every mutation and the skip reason', () => {
    const race = workout({ id: 'race', date: '2026-10-03', type: 'race', title: 'Broschtkriibslaf 5K Race' })
    const preview = formatGarminSyncPreview(
      build(plan([workout({ id: 'a', date: '2026-09-08', title: 'Aerobic Easy Run' }), race]), null),
    )

    expect(preview).toContain('Garmin sync preview')
    expect(preview).toContain('CREATE  2026-09-08  Aerobic Easy Run')
    expect(preview).toContain('SKIP    2026-10-03  Broschtkriibslaf 5K Race  Course-aware race - use Garmin PacePro')
    expect(preview).toContain('Create: 1')
    expect(preview).toContain('Skip: 1')
  })
})
