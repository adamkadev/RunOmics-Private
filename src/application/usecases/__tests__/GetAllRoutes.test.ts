import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: vi.fn() }))

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

  it('opens on the area with the most km, not the most recent run (v4.8)', async () => {
    const { getAllRoutes } = await load(HISTORY)
    const { clusters, defaultClusterIdx } = getAllRoutes()

    expect(defaultClusterIdx).toBe(0)
    expect(clusters[defaultClusterIdx]?.totalKm).toBe(20)
  })

  it('bounds a cluster by every trace inside it', async () => {
    const { getAllRoutes } = await load(HISTORY)
    const brussels = getAllRoutes().clusters[0]!

    expect(brussels.bounds).toEqual({ minLon: 4.3, maxLon: 4.32, minLat: 50.8, maxLat: 50.82 })
  })

  it('frames a cluster on the 4th to 96th percentile of its points, so one long run does not zoom it out (v4.17)', async () => {
    // 99 points on the home streets, one run's far end 20 km east.
    const home: [number, number][] = Array.from({ length: 99 }, (_, i) => [7.75 + i * 0.0001, 48.58 + i * 0.0001])
    const { getAllRoutes } = await load([activity('home', '2026-07-20', home), activity('far', '2026-07-19', [[7.75, 48.58], [8.02, 48.58]])])
    const cluster = getAllRoutes().clusters[0]!

    expect(cluster.bounds.maxLon).toBe(8.02)
    expect(cluster.frame.maxLon).toBeLessThan(7.77)
    expect(cluster.frame.minLat).toBeGreaterThanOrEqual(48.58)
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

  it('names an area after a place that was run, not the empty middle of its spots', async () => {
    // Nine runs within 12 km, so one area, whose mean lands in Souffelweyersheim,
    // where none of them went.
    const at = (lon: number, lat: number): [number, number][] => [[lon - 0.005, lat - 0.003], [lon + 0.005, lat + 0.003]]
    const runs = [
      ...[0, 1, 2, 3, 4].map((i) => activity(`lampertheim-${i}`, `2025-09-2${i}`, at(7.698 + i * 0.002, 48.649), 4)),
      ...[0, 1, 2].map((i) => activity(`bischheim-${i}`, `2025-10-0${i + 1}`, at(7.77 + i * 0.003, 48.612), 4)),
      activity('neudorf', '2025-10-10', at(7.786, 48.569), 6),
    ]
    const { getAllRoutes } = await load(runs)
    const [area] = getAllRoutes().clusters

    expect(area?.routeCount).toBe(9)
    // The mean sits between the spots…
    expect(area!.center[0]).toBeGreaterThan(7.72)
    // …the label on a Lampertheim run.
    const [lon, lat] = area!.labelPoint
    expect(lon).toBeLessThan(7.71)
    expect(lat).toBeCloseTo(48.649, 3)
  })

  it('labels a one-run area at that run', async () => {
    const { getAllRoutes } = await load([activity('a', '2026-07-20', [[2.3, 48.8], [2.32, 48.82]])])

    const [lon, lat] = getAllRoutes().clusters[0]!.labelPoint
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
