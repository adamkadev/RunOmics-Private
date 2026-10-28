import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import type { CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import { plan, workout as prescription } from '@/domain/coaching/__tests__/fixtures'
import { runVerdictInsightHash, runVerdictJudgement } from '@/domain/ai/runVerdictInsight'

const { getAllActivities, getAllPlannedWorkouts, readVerifiedInsight, coaching } = vi.hoisted(() => ({
  getAllActivities: vi.fn(),
  getAllPlannedWorkouts: vi.fn(),
  readVerifiedInsight: vi.fn(),
  coaching: { getCurrentPlan: vi.fn(), getArchivedPlans: vi.fn(), getEvaluations: vi.fn() },
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

const { getRunVerdictContexts, getRunVerdict } = await import('../GetRunVerdictInsight')
const getRunVerdictInsight = async (run: Activity) => (await getRunVerdict(run)).insight

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

function withHistory(
  activities: Activity[],
  planned: PlannedWorkout[] = [],
  plans: { current?: CoachingPlan | null; archived?: CoachingPlan[]; evaluations?: WorkoutEvaluation[] } = {}
) {
  getAllActivities.mockReturnValue(activities)
  getAllPlannedWorkouts.mockReturnValue(planned)
  coaching.getCurrentPlan.mockReturnValue(plans.current ?? null)
  coaching.getArchivedPlans.mockReturnValue(plans.archived ?? [])
  coaching.getEvaluations.mockReturnValue(plans.evaluations ?? [])
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

  it("attaches the type of the coach's session the run was matched to, which outranks the watch's guess", () => {
    const matched = { prescriptionId: prescription().id, activityId: 'a', matchStatus: 'matched' } as WorkoutEvaluation
    withHistory([activity('a', '2026-09-09'), activity('b', '2026-09-10')], [], { current: plan(), evaluations: [matched] })

    const [run, other] = getRunVerdictContexts()
    expect(run?.sessionType).toBe('Threshold')
    expect(other?.sessionType).toBeNull()
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

describe('getRunVerdict', () => {
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

describe('getRunVerdict tone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readVerifiedInsight.mockResolvedValue(INSIGHT)
  })

  it('gives the card the tone the written verdict was judged with', async () => {
    const run = activity('a', '2026-07-20', { rpe: 4 })
    withHistory([run])
    const verdict = await getRunVerdict(run)

    expect(verdict).toEqual({ insight: INSIGHT, tone: runVerdictJudgement(getRunVerdictContexts()[0]!).tone })
    expect(verdict.tone).toBe('neutral')
  })

  it('caps the tone when the reps missed the plan, as the prompt does, whatever the RPE says', async () => {
    const rep = (pace: number) => ({ type: 'interval_active', durationSec: 420, distanceM: (420 / pace) * 1000, avgSpeedMs: 0, avgHr: 175, laps: [] })
    const run = activity('a', '2026-07-20', { type: 'Threshold', rpe: 7, splits: [rep(250), rep(251), rep(250)] as never })
    const plan3x7 = {
      ...workout('2026-07-20'),
      steps: [1, 2, 3].map((n) => ({ kind: 'effort' as const, minutes: 7, rep: n, paceSecPerKm: [262, 268] as [number, number] })),
    }
    withHistory([run], [plan3x7])

    expect((await getRunVerdict(run)).tone).toBe('neutral')
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
      await fresh.getRunVerdict(activity('a', '2026-07-20'))

      expect(readVerifiedInsight).toHaveBeenCalledWith('runVerdict_a', expect.any(String))
    } finally {
      delete process.env.NEXT_PHASE
    }
  })
})
