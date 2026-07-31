import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: vi.fn() }))

// Two places ~220 km apart, so they can never fall inside the same cluster radius.
const PARIS: [number, number][] = [
  [2.3, 48.8],
  [2.32, 48.82],
]
const BRUSSELS: [number, number][] = [
  [4.3, 50.8],
  [4.32, 50.82],
]

function activity(id: string, date: string, route: [number, number][] | undefined, distanceKm = 10): Activity {
  return { id, date, type: 'Base', route, distanceKm, durationSeconds: 3000, paceSecPerKm: 300 } as Activity
}

// getAllRoutes caches per module instance, so every case gets a fresh one.
async function load(activities: Activity[]) {
  vi.resetModules()
  const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
  vi.mocked(getAllActivities).mockReturnValue(activities)

  const useCase = await import('../GetAllRoutes')
  return { ...useCase, getAllActivities: vi.mocked(getAllActivities) }
}

const HISTORY = [
  activity('paris', '2026-07-20T08:00:00', PARIS, 10),
  activity('brussels-new', '2026-07-10T08:00:00', BRUSSELS, 12),
  activity('brussels-old', '2025-07-01T08:00:00', BRUSSELS, 8),
]

describe('getAllRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('groups runs started in the same place into one cluster', async () => {
    const { getAllRoutes } = await load(HISTORY)

    expect(getAllRoutes().clusters.map((c) => c.routeCount)).toEqual([2, 1])
  })

  it('keeps distant places apart even when the run count would merge them', async () => {
    const { getAllRoutes } = await load([activity('a', '2026-07-20', PARIS), activity('b', '2026-07-19', BRUSSELS)])

    expect(getAllRoutes().clusters).toHaveLength(2)
  })

  it('orders the clusters by how much running happened there', async () => {
    const { getAllRoutes } = await load(HISTORY)
    const [busiest, quietest] = getAllRoutes().clusters

    expect(busiest?.totalKm).toBe(20)
    expect(quietest?.totalKm).toBe(10)
  })

  it('opens on the cluster the most recent run belongs to, not the busiest', async () => {
    const { getAllRoutes } = await load(HISTORY)
    const { clusters, defaultClusterIdx } = getAllRoutes()

    expect(defaultClusterIdx).toBe(1)
    expect(clusters[defaultClusterIdx]?.routeIndices).toEqual([0])
  })

  it('bounds a cluster by every trace inside it', async () => {
    const { getAllRoutes } = await load(HISTORY)
    const brussels = getAllRoutes().clusters[0]!

    expect(brussels.bounds).toEqual({ minLon: 4.3, maxLon: 4.32, minLat: 50.8, maxLat: 50.82 })
  })

  it('centres a cluster on its traces rather than on the first one seen', async () => {
    const { getAllRoutes } = await load([
      activity('a', '2026-07-20', [
        [2.3, 48.8],
        [2.3, 48.8],
      ]),
      activity('b', '2026-07-19', [
        [2.32, 48.82],
        [2.32, 48.82],
      ]),
    ])

    const [lon, lat] = getAllRoutes().clusters[0]!.center
    expect(lon).toBeCloseTo(2.31, 6)
    expect(lat).toBeCloseTo(48.81, 6)
  })

  it('drops runs with no usable trace from the map entirely', async () => {
    const { getAllRoutes } = await load([
      ...HISTORY,
      activity('indoor', '2026-07-15', undefined, 5),
      activity('one-point', '2026-07-14', [[2.3, 48.8]], 5),
    ])
    const data = getAllRoutes()

    expect(data.totalCount).toBe(3)
    expect(data.totalKm).toBe(30)
    expect(data.routeMeta.map((m) => m.id)).toEqual(['paris', 'brussels-new', 'brussels-old'])
  })

  it('describes each route with what the filters and the list rows read', async () => {
    const { getAllRoutes } = await load(HISTORY)

    expect(getAllRoutes().routeMeta[0]).toEqual({
      id: 'paris',
      type: 'Base',
      year: '2026',
      date: '2026-07-20',
      distanceKm: 10,
      durationSeconds: 3000,
      paceSecPerKm: 300,
    })
  })

  it('lists the years running was recorded, oldest first and once each', async () => {
    const { getAllRoutes } = await load([...HISTORY, activity('extra', '2025-03-01', PARIS)])

    expect(getAllRoutes().years).toEqual(['2025', '2026'])
  })

  it('keeps the route geometry in the same order as its metadata', async () => {
    const { getAllRoutes } = await load(HISTORY)

    expect(getAllRoutes().routes).toEqual([PARIS, BRUSSELS, BRUSSELS])
  })

  it('holds nothing when no run carries a trace', async () => {
    const { getAllRoutes } = await load([activity('indoor', '2026-07-20', undefined)])

    expect(getAllRoutes()).toEqual({
      routes: [],
      routeMeta: [],
      clusters: [],
      defaultClusterIdx: 0,
      totalCount: 0,
      totalKm: 0,
      years: [],
    })
  })

  it('clusters once and serves every later caller from the cache', async () => {
    const { getAllRoutes, getAllActivities } = await load(HISTORY)

    expect(getAllRoutes()).toBe(getAllRoutes())
    expect(getAllActivities).toHaveBeenCalledTimes(1)
  })
})

describe('getMapShellData', () => {
  it('carries the whole shell without a single coordinate', async () => {
    const { getMapShellData, getAllRoutes } = await load(HISTORY)
    const shell = getMapShellData()

    expect(shell).not.toHaveProperty('routes')
    expect(shell).toEqual({
      routeMeta: getAllRoutes().routeMeta,
      clusters: getAllRoutes().clusters,
      defaultClusterIdx: getAllRoutes().defaultClusterIdx,
      totalCount: 3,
      totalKm: 30,
      years: ['2025', '2026'],
    })
  })
})
