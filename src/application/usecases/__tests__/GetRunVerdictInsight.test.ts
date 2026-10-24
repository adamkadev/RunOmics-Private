import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan, workout as prescription } from '@/domain/coaching/__tests__/fixtures'
import { runVerdictInsightHash } from '@/domain/ai/runVerdictInsight'

const { getAllActivities, getAllPlannedWorkouts, readVerifiedInsight, coaching } = vi.hoisted(() => ({
  getAllActivities: vi.fn(),
  getAllPlannedWorkouts: vi.fn(),
  readVerifiedInsight: vi.fn(),
  coaching: { getCurrentPlan: vi.fn(), getArchivedPlans: vi.fn() },
}))

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))
vi.mock('@/infrastructure/repositories/JsonCoachingRepository', () => ({
  JsonCoachingRepository: vi.fn(function JsonCoachingRepository() {
    return coaching
  }),
}))
vi.mock('@/infrastructure/repositories/JsonPlannedWorkoutRepository', () => ({ getAllPlannedWorkouts }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/repositories/FirestoreInsightsRepository')>()
  return { ...actual, readVerifiedInsight }
})

const { getRunVerdictContexts, getRunVerdictInsight } = await import('../GetRunVerdictInsight')

const INSIGHT = { headline: 'Held together to the last rep', body: 'Only two seconds a kilometre of fade.' }

function activity(id: string, date: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    date,
    type: 'Base',
    description: 'Morning run',
    distanceKm: 10,
    durationSeconds: 3000,
    paceSecPerKm: 300,
    avgHeartRate: 148,
    rpe: 4,
    aerTrainingEffect: 3.1,
    elevationGain: 40,
    avgTemperature: 18,
    hrZones: [],
    splits: [],
    bestEfforts: {},
    ...overrides,
  } as unknown as Activity
}

const workout = (date: string, name = 'Threshold 3x8'): PlannedWorkout => ({
  date,
  name,
  type: 'Threshold',
  durationSecs: 2700,
})

function withHistory(activities: Activity[], planned: PlannedWorkout[] = [], plans: { current?: CoachingPlan | null; archived?: CoachingPlan[] } = {}) {
  getAllActivities.mockReturnValue(activities)
  getAllPlannedWorkouts.mockReturnValue(planned)
  coaching.getCurrentPlan.mockReturnValue(plans.current ?? null)
  coaching.getArchivedPlans.mockReturnValue(plans.archived ?? [])
}

describe('getRunVerdictContexts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds one context per run, so the generator can spot the stale ones in a single pass', () => {
    withHistory([activity('a', '2026-07-20'), activity('b', '2026-07-18'), activity('c', '2026-07-15')])

    expect(getRunVerdictContexts().map((c) => c.activity.id)).toEqual(['a', 'b', 'c'])
  })

  it('reads the activity list and the plan once, not once per run', () => {
    withHistory([activity('a', '2026-07-20'), activity('b', '2026-07-18')])
    getRunVerdictContexts()

    expect(getAllActivities).toHaveBeenCalledTimes(1)
    expect(getAllPlannedWorkouts).toHaveBeenCalledTimes(1)
  })

  it('attaches the session the plan held for that day', () => {
    const planned = workout('2026-07-20')
    withHistory([activity('a', '2026-07-20')], [workout('2026-07-18'), planned])

    expect(getRunVerdictContexts()[0]?.planned).toBe(planned)
  })

  it('matches the plan on the day, whatever time the run carries', () => {
    withHistory([activity('a', '2026-07-20T08:12:00')], [workout('2026-07-20')])

    expect(getRunVerdictContexts()[0]?.planned).not.toBeNull()
  })

  it('null when the plan held nothing that day', () => {
    withHistory([activity('a', '2026-07-20')], [workout('2026-07-18')])

    expect(getRunVerdictContexts()[0]?.planned).toBeNull()
  })

  it('carries the week the run sits in and the gap before it', () => {
    withHistory([
      activity('a', '2026-07-20'),
      activity('b', '2026-07-18'),
      activity('c', '2026-07-16'),
      activity('d', '2026-07-14'),
    ])

    expect(getRunVerdictContexts()[0]?.history.runsInPast7Days).toBe(4)
    expect(getRunVerdictContexts()[0]?.history.daysSinceLastRun).toBe(2)
  })

  it("attaches what the coaching plan wrote the session for, from an archived plan when it has been replaced", () => {
    const current = plan({ id: 'current', weeks: [] })
    const archived = plan({ id: 'archived', status: 'superseded' })
    withHistory([activity('a', '2026-09-09'), activity('b', '2026-09-08')], [], { current, archived: [archived] })

    const [planned, unplanned] = getRunVerdictContexts()
    expect(planned?.intent).toEqual({ title: prescription().title, description: prescription().description, weekFocus: 'Threshold introduction' })
    expect(unplanned?.intent).toBeNull()
    expect(coaching.getCurrentPlan).toHaveBeenCalledTimes(1)
    expect(coaching.getArchivedPlans).toHaveBeenCalledTimes(1)
  })

  it('still builds every context when a plan file cannot be read', () => {
    withHistory([activity('a', '2026-09-09')])
    coaching.getCurrentPlan.mockImplementation(() => {
      throw new Error('current_plan.json: weeks must be an array')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(getRunVerdictContexts()[0]?.intent).toBeNull()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('nothing to build from an athlete with no runs yet', () => {
    withHistory([])

    expect(getRunVerdictContexts()).toEqual([])
  })
})

describe('getRunVerdictInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withHistory([activity('a', '2026-07-20'), activity('b', '2026-07-18')])
  })

  it('hands back the cached verdict for that run', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getRunVerdictInsight(activity('a', '2026-07-20'))).toEqual(INSIGHT)
  })

  it('keys the verdict on the run and the history behind it', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getRunVerdictInsight(activity('a', '2026-07-20'))
    const context = getRunVerdictContexts()[0]!

    expect(readVerifiedInsight).toHaveBeenCalledWith('runVerdict_a', runVerdictInsightHash(context))
  })

  it('asks for a different verdict once the run itself reads differently', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getRunVerdictInsight(activity('a', '2026-07-20'))
    await getRunVerdictInsight(activity('a', '2026-07-20', { paceSecPerKm: 265, avgHeartRate: 168 }))

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1]).not.toBe(second?.[1])
  })
})

describe('getRunVerdictInsight read cost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withHistory([activity('a', '2026-07-20'), activity('b', '2026-07-18'), activity('c', '2026-07-15')])
    readVerifiedInsight.mockResolvedValue(null)
  })

  it('costs one read per run rendered, not one per run stored', async () => {
    for (const id of ['a', 'b', 'c']) await getRunVerdictInsight(activity(id, '2026-07-20'))

    expect(readVerifiedInsight).toHaveBeenCalledTimes(3)
    expect(readVerifiedInsight.mock.calls.map((call) => call[0])).toEqual([
      'runVerdict_a',
      'runVerdict_b',
      'runVerdict_c',
    ])
  })

  it('takes the same direct path during a production build', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    try {
      const fresh = await import('../GetRunVerdictInsight')
      await fresh.getRunVerdictInsight(activity('a', '2026-07-20'))

      expect(readVerifiedInsight).toHaveBeenCalledWith('runVerdict_a', expect.any(String))
    } finally {
      delete process.env.NEXT_PHASE
    }
  })
})
