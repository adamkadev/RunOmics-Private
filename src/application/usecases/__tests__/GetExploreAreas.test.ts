import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapShellData, RouteCluster, RouteMeta } from '../GetAllRoutes'
import type { ExploreAreaRef } from '@/domain/explore/types'

const mocks = vi.hoisted(() => ({
  listExploreAreas: vi.fn(),
  readExploreAreaFile: vi.fn(),
  getMapShellData: vi.fn(),
}))
vi.mock('@/infrastructure/repositories/JsonExploreAreaRepository', () => ({
  listExploreAreas: mocks.listExploreAreas,
  readExploreAreaFile: mocks.readExploreAreaFile,
}))
vi.mock('../GetAllRoutes', () => ({ getMapShellData: mocks.getMapShellData }))

const { getExploreAreaFile, getExploreAreas, getExploreHome, getExploreHomes } = await import('../GetExploreAreas')

// Fictional places around the demo dataset's mid-Pacific home.
const HOME: [number, number] = [-150, 0]
const AWAY: [number, number] = [-149, 3]
const town: ExploreAreaRef = { id: 'town', name: 'Town', version: 'town-20261022-0123abcd', bbox: [-150.05, -0.05, -149.95, 0.05] }

function cluster(id: string, at: [number, number], routeIndices: number[]): RouteCluster {
  const bounds = { minLon: at[0], maxLon: at[0], minLat: at[1], maxLat: at[1] }
  return { id, routeCount: routeIndices.length, totalKm: 10, center: at, labelPoint: at, bounds, frame: bounds, routeIndices }
}

function meta(id: string, date: string): RouteMeta {
  return { id, type: 'Base', year: date.slice(0, 4), date, distanceKm: 5, durationSeconds: 1800, paceSecPerKm: 360 }
}

function withMap(overrides: Partial<MapShellData> = {}) {
  mocks.getMapShellData.mockReturnValue({
    routeMeta: [meta('a3', '2026-10-20'), meta('b1', '2026-10-18'), meta('a1', '2026-10-15T07:30:00Z')],
    clusters: [cluster('1', HOME, [0, 2]), cluster('0', AWAY, [1])],
    defaultClusterIdx: 0,
    totalCount: 3,
    totalKm: 15,
    years: ['2026'],
    ...overrides,
  } satisfies MapShellData)
}

describe('GetExploreAreas', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.listExploreAreas.mockReturnValue([town])
    withMap()
  })

  it('passes the areas and their files through', () => {
    const file = { version: town.version, body: '{}' }
    mocks.readExploreAreaFile.mockReturnValue(file)

    expect(getExploreAreas()).toEqual([town])
    expect(getExploreAreaFile('town')).toBe(file)
    expect(mocks.readExploreAreaFile).toHaveBeenCalledWith('town')
  })

  it("names the home cluster's area and its runs, by activity id and day", () => {
    const home = getExploreHome()

    expect(home).toMatchObject({
      area: town,
      clusterId: '1',
      runs: [
        { routeIdx: 0, id: 'a3', date: '2026-10-20' },
        { routeIdx: 2, id: 'a1', date: '2026-10-15' },
      ],
    })
    expect(home?.dataVersion).toMatch(/^[0-9a-f]{12}$/)
  })

  it('versions the runs by their ids alone, whatever order or index they come in', () => {
    const before = getExploreHome()!.dataVersion

    withMap({
      routeMeta: [meta('new', '2026-10-21'), meta('a3', '2026-10-20'), meta('b1', '2026-10-18'), meta('a1', '2026-10-15')],
      clusters: [cluster('3', HOME, [3, 1]), cluster('0', AWAY, [2])],
    })
    expect(getExploreHome()!.dataVersion).toBe(before)

    withMap({
      routeMeta: [meta('new', '2026-10-21'), meta('a3', '2026-10-20'), meta('a1', '2026-10-15')],
      clusters: [cluster('1', HOME, [0, 1, 2])],
    })
    expect(getExploreHome()!.dataVersion).not.toBe(before)
  })

  it('gives each area its busiest cluster, busiest first, and skips a second cluster in the same area', () => {
    const away: ExploreAreaRef = { id: 'away', name: 'Away', version: 'away-20261022-0123abcd', bbox: [-149.05, 2.95, -148.95, 3.05] }
    mocks.listExploreAreas.mockReturnValue([town, away])
    withMap({ clusters: [cluster('1', HOME, [0]), cluster('0', AWAY, [1]), cluster('2', HOME, [2])] })

    expect(getExploreHomes().map((home) => [home.area.id, home.clusterId, home.runs.map((run) => run.id)])).toEqual([
      ['town', '1', ['a3']],
      ['away', '0', ['b1']],
    ])
  })

  it('has no Explore home without areas, or for a cluster no area covers', () => {
    mocks.listExploreAreas.mockReturnValue([])
    expect(getExploreHome()).toBeNull()
    expect(mocks.getMapShellData).not.toHaveBeenCalled()

    mocks.listExploreAreas.mockReturnValue([town])
    withMap({ defaultClusterIdx: 1 })
    expect(getExploreHome()).toBeNull()

    withMap({ clusters: [] })
    expect(getExploreHome()).toBeNull()
  })
})
