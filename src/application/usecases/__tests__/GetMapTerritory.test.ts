import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AllRoutesData, RouteCluster } from '../GetAllRoutes'

const { getAllRoutes } = vi.hoisted(() => ({ getAllRoutes: vi.fn() }))
vi.mock('../GetAllRoutes', () => ({ getAllRoutes }))

const { getMapTerritory } = await import('../GetMapTerritory')

const CENTER: [number, number] = [2.3, 48.8]

const at = (lon: number, lat: number): [number, number][] => [
  [lon, lat],
  [lon, lat],
]

function cluster(overrides: Partial<RouteCluster> = {}): RouteCluster {
  return {
    id: '0',
    routeCount: 2,
    totalKm: 30,
    center: CENTER,
    bounds: { minLon: 2.3, maxLon: 2.4, minLat: 48.8, maxLat: 48.9 },
    routeIndices: [0, 1],
    ...overrides,
  }
}

function withMap(overrides: Partial<AllRoutesData> = {}) {
  getAllRoutes.mockReturnValue({
    routes: [at(2.3, 48.8), at(2.3, 49.8)],
    routeMeta: [],
    clusters: [cluster()],
    defaultClusterIdx: 0,
    totalCount: 2,
    totalKm: 100,
    years: ['2026'],
    ...overrides,
  })
}

describe('getMapTerritory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('describes the busiest cluster, which sorting puts first', () => {
    withMap({
      clusters: [cluster({ routeCount: 2, totalKm: 30 }), cluster({ id: '1', routeCount: 1, totalKm: 5 })],
    })

    expect(getMapTerritory()?.routeCount).toBe(2)
  })

  it('reports the share of the total distance run there', () => {
    withMap()

    expect(getMapTerritory()?.percentVolume).toBe(30)
  })

  it('rounds the share to a whole percent', () => {
    withMap({ clusters: [cluster({ totalKm: 33 })], totalKm: 90 })

    expect(getMapTerritory()?.percentVolume).toBe(37)
  })

  it('measures how far the runs spread from the centre, as a median', () => {
    withMap()

    // One trace on the centre, one a degree of latitude away (~111.3 km).
    expect(getMapTerritory()?.medianRadiusKm).toBe(55.7)
  })

  it('keeps the cluster centre as the territory centre', () => {
    withMap()

    expect(getMapTerritory()?.center).toEqual(CENTER)
  })

  it('null when nothing has been mapped yet', () => {
    withMap({ clusters: [], routes: [], totalKm: 0 })

    expect(getMapTerritory()).toBeNull()
  })

  it('null when no distance was recorded, rather than dividing by zero', () => {
    withMap({ totalKm: 0 })

    expect(getMapTerritory()).toBeNull()
  })

  it('null when the cluster points at traces that are not there', () => {
    withMap({ clusters: [cluster({ routeIndices: [7, 8] })] })

    expect(getMapTerritory()).toBeNull()
  })

  it('ignores an empty trace instead of counting it as a zero radius', () => {
    withMap({ routes: [[], at(2.3, 49.8)] })

    expect(getMapTerritory()?.medianRadiusKm).toBe(111.3)
  })
})
