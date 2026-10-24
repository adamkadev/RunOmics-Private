import { describe, it, expect } from 'vitest'
import {
  matchesFilters,
  activeFilterCount,
  buildHeatTracks,
  mercatorX,
  mercatorY,
  HEAT_DARK,
  heatLineWidth,
  heatFrequency,
  reachKm,
  ringCoordinates,
  areaRows,
  computeAreaTerritory,
  type HeatFilters,
} from '../mapUtils'
import { distanceKm } from '@/lib/math'
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

const f = (over: Partial<HeatFilters> = {}): HeatFilters => ({ years: [], types: [], ...over })

describe('activeFilterCount', () => {
  it('counts the narrowed filters, not the ticks', () => {
    expect(activeFilterCount(f())).toBe(0)
    expect(activeFilterCount(f({ types: ['Race', 'Tempo'] }))).toBe(1)
    expect(activeFilterCount(f({ types: ['Race'], years: ['2026', '2025'] }))).toBe(2)
  })
})

describe('matchesFilters', () => {
  it('false with no meta', () => {
    expect(matchesFilters(undefined, f())).toBe(false)
  })

  it('true with no active filters', () => {
    expect(matchesFilters(meta(), f())).toBe(true)
  })

  it('filters by year', () => {
    expect(matchesFilters(meta({ year: '2025' }), f({ years: ['2026'] }))).toBe(false)
    expect(matchesFilters(meta({ year: '2026' }), f({ years: ['2026'] }))).toBe(true)
  })

  it('takes any of several types or years', () => {
    expect(matchesFilters(meta({ type: 'Tempo' }), f({ types: ['Race', 'Tempo'] }))).toBe(true)
    expect(matchesFilters(meta({ type: 'Base' }), f({ types: ['Race', 'Tempo'] }))).toBe(false)
    expect(matchesFilters(meta({ year: '2025' }), f({ years: ['2026', '2025'] }))).toBe(true)
  })

  it('combines year and type (both must match)', () => {
    expect(matchesFilters(meta({ year: '2026', type: 'Base' }), f({ years: ['2026'], types: ['Base'] }))).toBe(true)
    expect(matchesFilters(meta({ year: '2026', type: 'Base' }), f({ years: ['2026'], types: ['Race'] }))).toBe(false)
  })
})

describe('buildHeatTracks (v4.17)', () => {
  const pairs = (track: Float64Array) => Array.from({ length: track.length / 2 }, (_, i) => [track[2 * i]!, track[2 * i + 1]!])

  it('turns each run into one list of Mercator x, y pairs', () => {
    const routes: [number, number][][] = [[[0, 0], [0.001, 0]], [[7.7, 48.6], [7.701, 48.6]]]
    const tracks = buildHeatTracks(routes, [0, 1])
    expect(tracks).toHaveLength(2)
    expect(pairs(tracks[0]!)[0]).toEqual([0.5, 0.5])
    expect(tracks[1]![0]).toBeCloseTo(mercatorX(7.7), 12)
    expect(tracks[1]![1]).toBeCloseTo(mercatorY(48.6), 12)
  })

  it('draws only the runs asked for, and none with fewer than two points', () => {
    const routes: [number, number][][] = [[[7.7, 48.6]], [[7.7, 48.6], [7.701, 48.6]], [[7.7, 48.6], [7.701, 48.6]]]
    expect(buildHeatTracks(routes, [0, 1])).toHaveLength(1)
  })

  it('agrees with MapLibre on the projection: north is up and y grows south', () => {
    expect(mercatorY(0)).toBeCloseTo(0.5, 12)
    expect(mercatorY(48.6)).toBeLessThan(0.5)
    expect(mercatorX(-180)).toBe(0)
    expect(mercatorX(180)).toBe(1)
  })
})

describe('GPS jumps (v5.6 #5)', () => {
  it('lifts the pen at a step longer than 150 m, so no straight line fans out', () => {
    // 50 m steps, then a 1.1 km jump, then 50 m steps again.
    const step = 0.00045
    const route: [number, number][] = [
      [6.17, 49.11], [6.17 + step, 49.11], [6.17 + 2 * step, 49.11],
      [6.19, 49.12], [6.19 + step, 49.12], [6.19 + 2 * step, 49.12],
    ]
    const [track] = buildHeatTracks([route], [0])
    const xs = Array.from({ length: track!.length / 2 }, (_, i) => track![2 * i]!)
    // Six points and one NaN break, between the two stretches.
    expect(xs).toHaveLength(7)
    expect(xs.findIndex(Number.isNaN)).toBe(3)
  })

  it('keeps a run with no jump as one unbroken stroke', () => {
    const [track] = buildHeatTracks([[[7.7, 48.6], [7.7005, 48.6], [7.701, 48.6]]], [0])
    expect(Array.from(track!).some(Number.isNaN)).toBe(false)
  })
})

describe('the dark heatmap, variant A (Wave 6b)', () => {
  it('adds every run on its own: a faint wide glow, then a thin core, faded for rare streets', () => {
    expect(HEAT_DARK.composite).toBe('lighter')
    expect(HEAT_DARK.passes).toEqual([
      { width: 4, alpha: 0.025 },
      { width: 1, alpha: 0.07 },
    ])
  })

  it('widens its lines from 1.2 px at city zoom to 4 px on a street', () => {
    expect(heatLineWidth(11)).toBe(1.2)
    expect(heatLineWidth(16)).toBe(4)
  })
})

describe('heatFrequency', () => {
  it('normalises run counts on a log scale against the busiest street', () => {
    expect(heatFrequency(50, 50)).toBe(1)
    expect(heatFrequency(0, 50)).toBe(0)
    expect(heatFrequency(7, 63)).toBeCloseTo(0.5, 10)
  })

  it('leaves one run everywhere at the faint end', () => {
    expect(heatFrequency(1, 1)).toBeLessThan(1)
  })
})

describe('reachKm', () => {
  it('rounds the median reach up, never below 1 km', () => {
    expect(reachKm(0.6)).toBe(1)
    expect(reachKm(1.21)).toBe(1.3)
    expect(reachKm(1.2)).toBe(1.2)
  })
})

describe('ringCoordinates', () => {
  it('closes a ring the given distance from home, east-west and north-south alike', () => {
    const home: [number, number] = [7.75, 48.58]
    const ring = ringCoordinates(home, 1.2)
    expect(ring[0]).toEqual(ring.at(-1))
    for (const [lon, lat] of ring) expect(distanceKm(lon, lat, home[0], home[1])).toBeCloseTo(1.2, 3)
  })
})

const cluster = (id: string, routeIndices: number[]): RouteCluster => ({
  id,
  routeCount: routeIndices.length,
  totalKm: 0,
  center: [0, 0],
  labelPoint: [0, 0],
  bounds: { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 },
  frame: { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 },
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
    expect(areaRows(clusters, routeMeta, { years: [], types: [] })).toEqual([
      { idx: 1, runs: 1, km: 18, sharePercent: 45 },
      { idx: 0, runs: 3, km: 22, sharePercent: 55 },
    ].sort((a, b) => b.km - a.km))
  })

  it('follows the filters and drops areas left empty', () => {
    const rows = areaRows(clusters, routeMeta, { years: ['2025'], types: [] })
    expect(rows).toEqual([{ idx: 0, runs: 1, km: 10, sharePercent: 100 }])
  })
})

describe('computeAreaTerritory', () => {
  it('shares by km and carries the area km', () => {
    const routeMeta = [meta({ distanceKm: 30 }), meta({ distanceKm: 10 })]
    const routes: [number, number][][] = [[[0, 0], [0.001, 0.001]], [[1, 1], [1.001, 1.001]]]
    const territory = computeAreaTerritory(cluster('a', [0]), routeMeta, routes, { years: [], types: [] })
    expect(territory).toMatchObject({ percentVolume: 75, km: 30, routeCount: 1 })
  })

  // Three runs from the same door: 1 km, 2 km and 5 km out, due east.
  const east = (km: number): [number, number][] => [[7.75, 48.58], [7.75 + km / (111.32 * Math.cos((48.58 * Math.PI) / 180)), 48.58], [7.75, 48.58]]
  const routeMeta = [meta(), meta(), meta({ year: '2025' })]
  const routes = [east(1), east(2), east(5)]

  it('puts home where the runs start and the reach at the median furthest point (v4.17)', () => {
    const territory = computeAreaTerritory(cluster('a', [0, 1, 2]), routeMeta, routes, { years: [], types: [] })!
    expect(territory.home).toEqual([7.75, 48.58])
    expect(territory.medianReachKm).toBe(2)
  })

  it('reads the reach from the runs the filters keep', () => {
    const territory = computeAreaTerritory(cluster('a', [0, 1, 2]), routeMeta, routes, { years: ['2025'], types: [] })!
    expect(territory.medianReachKm).toBe(5)
    expect(territory.routeCount).toBe(1)
  })

  it('has no card until the area\'s routes have arrived', () => {
    expect(computeAreaTerritory(cluster('a', [0, 1, 2]), routeMeta, [], { years: [], types: [] })).toBeNull()
  })
})
