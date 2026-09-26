import { describe, it, expect } from 'vitest'
import {
  matchesFilters,
  buildHeatGeoJSON,
  heatColorExpression,
  areaRows,
  computeAreaTerritory,
  type HeatFilters,
} from '../mapUtils'
import type { RouteCluster, RouteMeta } from '@/application/usecases/GetAllRoutes'

const meta = (over: Partial<RouteMeta> = {}): RouteMeta => ({
  id: 'a1',
  type: 'Base',
  year: '2026',
  date: '2026-01-01',
  distanceKm: 5,
  durationSeconds: 1500,
  paceSecPerKm: 300,
  ...over,
})

const f = (over: Partial<HeatFilters> = {}): HeatFilters => ({ year: null, type: null, ...over })

describe('matchesFilters', () => {
  it('false with no meta', () => {
    expect(matchesFilters(undefined, f())).toBe(false)
  })

  it('true with no active filters', () => {
    expect(matchesFilters(meta(), f())).toBe(true)
  })

  it('filters by year', () => {
    expect(matchesFilters(meta({ year: '2025' }), f({ year: '2026' }))).toBe(false)
    expect(matchesFilters(meta({ year: '2026' }), f({ year: '2026' }))).toBe(true)
  })

  it('filters by type', () => {
    expect(matchesFilters(meta({ type: 'Base' }), f({ type: 'Race' }))).toBe(false)
    expect(matchesFilters(meta({ type: 'Race' }), f({ type: 'Race' }))).toBe(true)
  })

  it('combines year and type (both must match)', () => {
    expect(matchesFilters(meta({ year: '2026', type: 'Base' }), f({ year: '2026', type: 'Base' }))).toBe(true)
    expect(matchesFilters(meta({ year: '2026', type: 'Base' }), f({ year: '2026', type: 'Race' }))).toBe(false)
  })
})

describe('buildHeatGeoJSON', () => {
  it('counts a shared stretch as run twice, keeping the original coordinates', () => {
    const routes: [number, number][][] = [
      [[7.7, 48.6], [7.701, 48.6], [7.702, 48.6]],
      [[7.7, 48.6], [7.701, 48.6], [7.702, 48.6]],
    ]
    const { data, maxCount } = buildHeatGeoJSON(routes, [0, 1])
    expect(maxCount).toBe(2)
    expect(data.features).toHaveLength(2)
    for (const feat of data.features) {
      expect(feat.properties?.count).toBe(2)
      expect(feat.geometry).toEqual({
        type: 'LineString',
        coordinates: [[7.7, 48.6], [7.701, 48.6], [7.702, 48.6]],
      })
    }
  })

  it('gives opposite directions of the same stretch the same shared count', () => {
    const routes: [number, number][][] = [
      [[7.7, 48.6], [7.701, 48.6]],
      [[7.701, 48.6], [7.7, 48.6]],
    ]
    const { data, maxCount } = buildHeatGeoJSON(routes, [0, 1])
    expect(maxCount).toBe(2)
    expect(data.features).toHaveLength(2)
    for (const feat of data.features) {
      expect(feat.properties?.count).toBe(2)
    }
  })

  it('splits a route into separate features where run frequency changes', () => {
    const routes: [number, number][][] = [
      [[7.6, 48.6], [7.7, 48.6], [7.8, 48.6], [7.9, 48.6]],
      [[7.6, 48.6], [7.7, 48.6]],
    ]
    const { data, maxCount } = buildHeatGeoJSON(routes, [0, 1])
    expect(maxCount).toBe(2)
    expect(data.features).toHaveLength(3)
    const counts = data.features.map((f) => f.properties?.count).sort()
    expect(counts).toEqual([1, 2, 2])
  })

  it('ignores routes with fewer than two points', () => {
    const routes: [number, number][][] = [[[7.7, 48.6]]]
    const { data, maxCount } = buildHeatGeoJSON(routes, [0])
    expect(data.features).toHaveLength(0)
    expect(maxCount).toBe(1)
  })
})

describe('heatColorExpression', () => {
  it('scales stops to the observed max frequency', () => {
    const expr = heatColorExpression(10)
    expect(expr[0]).toBe('interpolate')
    expect(expr[3]).toBe(1)
    expect(expr[expr.length - 2]).toBe(10)
  })

  it('spaces stops logarithmically so mid colours fall on low counts', () => {
    const expr = heatColorExpression(100)
    const secondStop = expr[5] as number
    const thirdStop = expr[7] as number
    expect(secondStop).toBeLessThan(10)
    expect(thirdStop).toBeLessThan(30)
    const stops = [expr[3], expr[5], expr[7], expr[9]] as number[]
    expect(stops).toEqual([...stops].sort((a, b) => a - b))
    expect(new Set(stops).size).toBe(4)
  })

  it('stays valid (strictly ascending) with no overlaps', () => {
    const stops = [1, 3, 5, 7].map((i) => heatColorExpression(1)[i] as number)
    expect(stops).toEqual([...stops].sort((a, b) => a - b))
    expect(new Set(stops).size).toBe(4)
  })
})

const cluster = (id: string, routeIndices: number[]): RouteCluster => ({
  id,
  routeCount: routeIndices.length,
  totalKm: 0,
  center: [0, 0],
  bounds: { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 },
  routeIndices,
})

describe('areaRows', () => {
  const routeMeta = [
    meta({ distanceKm: 10 }),
    meta({ distanceKm: 10, year: '2025' }),
    meta({ distanceKm: 2 }),
    meta({ distanceKm: 18 }),
  ]
  const clusters = [cluster('many-short', [0, 1, 2]), cluster('one-long', [3])]

  it('orders areas by km and states each share of km, the card basis (v4.8)', () => {
    expect(areaRows(clusters, routeMeta, { year: null, type: null })).toEqual([
      { idx: 1, runs: 1, km: 18, sharePercent: 45 },
      { idx: 0, runs: 3, km: 22, sharePercent: 55 },
    ].sort((a, b) => b.km - a.km))
  })

  it('follows the filters and drops areas left empty', () => {
    const rows = areaRows(clusters, routeMeta, { year: '2025', type: null })
    expect(rows).toEqual([{ idx: 0, runs: 1, km: 10, sharePercent: 100 }])
  })
})

describe('computeAreaTerritory', () => {
  it('shares by km and carries the area km', () => {
    const routeMeta = [meta({ distanceKm: 30 }), meta({ distanceKm: 10 })]
    const routes: [number, number][][] = [[[0, 0], [0.001, 0.001]], [[1, 1], [1.001, 1.001]]]
    const territory = computeAreaTerritory(cluster('a', [0]), routeMeta, routes, { year: null, type: null })
    expect(territory).toMatchObject({ percentVolume: 75, km: 30, routeCount: 1 })
  })
})
