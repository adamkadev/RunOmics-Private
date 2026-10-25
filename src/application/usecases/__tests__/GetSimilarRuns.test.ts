import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: vi.fn() }))

vi.mock('@/lib/routeMatch', () => ({
  SIMILAR_ROUTE_MIN_SIMILARITY: 0.85,
  buildRouteCellSet: vi.fn(() => ({ cells: new Set<string>(), size: 0 })),
  isSimilarDistance: vi.fn(() => true),
  routeSimilarity: vi.fn(() => 1),
}))

const ROUTE: [number, number][] = [
  [2.3, 48.8],
  [2.31, 48.81],
]

function activity(id: string, date: string, paceSecPerKm: number | null, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    date,
    paceSecPerKm,
    route: ROUTE,
    distanceKm: 10,
    durationSeconds: paceSecPerKm === null ? 3000 : paceSecPerKm * 10,
    ...overrides,
  } as Activity
}

interface Matcher {
  similarDistance?: boolean
  similarity?: number
}

async function run(activities: Activity[], activityId: string, matcher: Matcher = {}) {
  const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
  const { isSimilarDistance, routeSimilarity } = await import('@/lib/routeMatch')

  vi.mocked(getAllActivities).mockReturnValue(activities)
  vi.mocked(isSimilarDistance).mockReturnValue(matcher.similarDistance ?? true)
  vi.mocked(routeSimilarity).mockReturnValue(matcher.similarity ?? 1)

  const { getSimilarRuns } = await import('../GetSimilarRuns')
  return getSimilarRuns(activityId)
}

describe('getSimilarRuns', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('null for an activity that is not in the set', async () => {
    expect(await run([activity('a', '2026-01-01', 300)], 'missing')).toBeNull()
  })

  it('null for a run with no usable GPS trace', async () => {
    expect(await run([activity('a', '2026-01-01', 300, { route: undefined })], 'a')).toBeNull()
    expect(await run([activity('a', '2026-01-01', 300, { route: [[2.3, 48.8]] })], 'a')).toBeNull()
  })

  it('null for a run with no pace to rank on', async () => {
    expect(await run([activity('a', '2026-01-01', null)], 'a')).toBeNull()
  })

  it('null below the three passes a progression needs', async () => {
    const two = [activity('a', '2026-01-01', 300), activity('b', '2026-02-01', 310)]
    expect(await run(two, 'a')).toBeNull()

    const three = [...two, activity('c', '2026-03-01', 290)]
    expect(await run(three, 'a')).not.toBeNull()
  })

  it('ranks the matched passes by pace, fastest first', async () => {
    const data = await run(
      [
        activity('slow', '2026-01-01', 320),
        activity('fast', '2026-02-01', 280),
        activity('mid', '2026-03-01', 300),
      ],
      'mid',
    )

    const rankById = Object.fromEntries(data!.runs.map((r) => [r.id, r.rank]))
    expect(rankById).toEqual({ fast: 1, mid: 2, slow: 3 })
    expect(data?.currentRank).toBe(2)
    expect(data?.bestPaceSecPerKm).toBe(280)
  })

  it('orders the series oldest first, whatever the ranking says', async () => {
    const data = await run(
      [
        activity('c', '2026-03-01', 280),
        activity('a', '2026-01-01', 320),
        activity('b', '2026-02-01', 300),
      ],
      'a',
    )

    expect(data?.runs.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('marks which pass is the one being viewed', async () => {
    const data = await run(
      [
        activity('a', '2026-01-01', 320),
        activity('b', '2026-02-01', 300),
        activity('c', '2026-03-01', 280),
      ],
      'b',
    )

    expect(data?.runs.filter((r) => r.isCurrent).map((r) => r.id)).toEqual(['b'])
    expect(data?.count).toBe(3)
  })

  it('excludes runs the matcher rejects on distance', async () => {
    const three = [
      activity('a', '2026-01-01', 320),
      activity('b', '2026-02-01', 300),
      activity('c', '2026-03-01', 280),
    ]
    expect(await run(three, 'a', { similarDistance: false })).toBeNull()
  })

  it('excludes runs whose route overlap falls under the threshold', async () => {
    const three = [
      activity('a', '2026-01-01', 320),
      activity('b', '2026-02-01', 300),
      activity('c', '2026-03-01', 280),
    ]
    expect(await run(three, 'a', { similarity: 0.5 })).toBeNull()
  })

  it('excludes other passes that have no usable GPS trace of their own', async () => {
    const data = await run(
      [
        activity('a', '2026-01-01', 300),
        activity('noRoute', '2026-02-01', 290, { route: undefined }),
        activity('onePoint', '2026-03-01', 285, { route: [[2.3, 48.8]] }),
        activity('c', '2026-04-01', 280),
        activity('d', '2026-05-01', 310),
      ],
      'a',
    )

    expect(data?.runs.map((r) => r.id)).toEqual(['a', 'c', 'd'])
    expect(data?.count).toBe(3)
  })

  it('keeps the viewed run even when other passes lack a pace', async () => {
    const data = await run(
      [
        activity('a', '2026-01-01', 300),
        activity('b', '2026-02-01', null),
        activity('c', '2026-03-01', 280),
        activity('d', '2026-04-01', 310),
      ],
      'a',
    )

    expect(data?.runs.map((r) => r.id)).toEqual(['a', 'c', 'd'])
    expect(data?.count).toBe(3)
  })

  it('works a run out once per data, however often its page renders', async () => {
    const three = [activity('a', '2026-01-01', 300), activity('b', '2026-02-01', 290), activity('c', '2026-03-01', 280)]
    const first = await run(three, 'a')
    const { routeSimilarity } = await import('@/lib/routeMatch')
    const { getSimilarRuns } = await import('../GetSimilarRuns')
    vi.mocked(routeSimilarity).mockClear()

    expect(getSimilarRuns('a')).toBe(first)
    expect(routeSimilarity).not.toHaveBeenCalled()
  })
})
