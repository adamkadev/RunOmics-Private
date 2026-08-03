import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { runVerdictInsightHash } from '@/domain/ai/runVerdictInsight'

const { getAllActivities, getAllPlannedWorkouts, readVerifiedInsight, getCachedInsightsByPrefix } = vi.hoisted(() => ({
  getAllActivities: vi.fn(),
  getAllPlannedWorkouts: vi.fn(),
  readVerifiedInsight: vi.fn(),
  getCachedInsightsByPrefix: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))
vi.mock('@/infrastructure/repositories/JsonPlannedWorkoutRepository', () => ({ getAllPlannedWorkouts }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/repositories/FirestoreInsightsRepository')>()
  return { ...actual, readVerifiedInsight, getCachedInsightsByPrefix }
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

function withHistory(activities: Activity[], planned: PlannedWorkout[] = []) {
  getAllActivities.mockReturnValue(activities)
  getAllPlannedWorkouts.mockReturnValue(planned)
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

  it('null when the cached verdict has gone stale, so the card keeps its rules-based copy', async () => {
    readVerifiedInsight.mockResolvedValue(null)

    expect(await getRunVerdictInsight(activity('a', '2026-07-20'))).toBeNull()
  })

  it('gives each run its own document', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getRunVerdictInsight(activity('a', '2026-07-20'))

    expect(readVerifiedInsight).toHaveBeenCalledWith('runVerdict_a', expect.any(String))
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

// generateStaticParams pre-renders one page per run in the same build process,
// so this is the one path that has to survive hundreds of calls without hitting
// Firestore hundreds of times - see getRunVerdictInsight's isProductionBuild
// branch. Reimports the module fresh each time so the build-lifetime cache
// inside it doesn't leak between cases.
describe('getRunVerdictInsight during a production build', () => {
  const PROJECT_ID = 'runomics-test'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    withHistory([activity('a', '2026-07-20'), activity('b', '2026-07-18')])
    process.env.NEXT_PHASE = 'phase-production-build'
    process.env.FIREBASE_PROJECT_ID = PROJECT_ID
  })

  afterEach(() => {
    delete process.env.NEXT_PHASE
    delete process.env.FIREBASE_PROJECT_ID
  })

  it('fetches every run verdict once and reuses it for the rest of the build', async () => {
    const fresh = await import('../GetRunVerdictInsight')
    const hash = runVerdictInsightHash(fresh.getRunVerdictContexts()[0]!)
    getCachedInsightsByPrefix.mockResolvedValue(new Map([['runVerdict_a', { ...INSIGHT, hash }]]))

    await fresh.getRunVerdictInsight(activity('a', '2026-07-20'))
    await fresh.getRunVerdictInsight(activity('b', '2026-07-18'))

    expect(getCachedInsightsByPrefix).toHaveBeenCalledTimes(1)
    expect(readVerifiedInsight).not.toHaveBeenCalled()
  })

  it('serves the cached verdict for the run it belongs to', async () => {
    const fresh = await import('../GetRunVerdictInsight')
    const hash = runVerdictInsightHash(fresh.getRunVerdictContexts()[0]!)
    getCachedInsightsByPrefix.mockResolvedValue(new Map([['runVerdict_a', { ...INSIGHT, hash }]]))

    expect(await fresh.getRunVerdictInsight(activity('a', '2026-07-20'))).toEqual(INSIGHT)
    expect(await fresh.getRunVerdictInsight(activity('b', '2026-07-18'))).toBeNull()
  })

  it('falls back quietly when the batch fetch fails', async () => {
    getCachedInsightsByPrefix.mockRejectedValue(new Error('unreachable'))

    const fresh = await import('../GetRunVerdictInsight')

    expect(await fresh.getRunVerdictInsight(activity('a', '2026-07-20'))).toBeNull()
  })

  it('never touches Firestore without admin credentials', async () => {
    delete process.env.FIREBASE_PROJECT_ID

    const fresh = await import('../GetRunVerdictInsight')

    expect(await fresh.getRunVerdictInsight(activity('a', '2026-07-20'))).toBeNull()
    expect(getCachedInsightsByPrefix).not.toHaveBeenCalled()
  })
})
