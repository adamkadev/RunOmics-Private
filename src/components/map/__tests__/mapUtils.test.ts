import { describe, it, expect } from 'vitest'
import {
  matchesFilters,
  buildHeatTracks,
  mercatorX,
  mercatorY,
  HEAT_DARK_CAP_ALPHA,
  HEAT_STYLE,
  heatLineWidth,
  heatPasses,
  rgba,
  reachKm,
  ringCoordinates,
  areaRows,
  computeAreaTerritory,
  type HeatFilters,
} from '../mapUtils'
import { distanceKm } from '@/lib/math'
import { heatRamp } from '@/lib/heatRamp'
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
    // Six points and one break, and the break sits between the two stretches.
    expect(xs).toHaveLength(7)
    expect(xs.findIndex(Number.isNaN)).toBe(3)
  })

  it('keeps a run with no jump as one unbroken stroke', () => {
    const [track] = buildHeatTracks([[[7.7, 48.6], [7.7005, 48.6], [7.701, 48.6]]], [0])
    expect(Array.from(track!).some(Number.isNaN)).toBe(false)
  })
})

describe('HEAT_STYLE (v4.17)', () => {
  it('adds light on dark and multiplies ink on light, so overlaps build up', () => {
    expect(HEAT_STYLE.dark.composite).toBe('lighter')
    expect(HEAT_STYLE.light.composite).toBe('multiply')
  })

  it('draws a wide faint glow before a thin core on dark', () => {
    const [glow, core] = HEAT_STYLE.dark.passes
    expect(glow!.width).toBeGreaterThan(core!.width)
    expect(glow!.alpha).toBeLessThan(core!.alpha)
    expect(core!.width).toBe(1)
  })

  // App Fixes 4a: a blurred halo under a ramp that runs pale tint, accent,
  // deep shade - so a route run many times multiplies down to ink.
  it('draws light mode as a halo under a pale-to-deep ramp', () => {
    const tones = HEAT_STYLE.light.passes.map((p) => p.tone)
    expect(tones).toEqual(['halo', 'tint', 'accent', 'deep'])
    const [halo, ...ramp] = HEAT_STYLE.light.passes
    expect(halo!.blur).toBeGreaterThan(0)
    expect(halo!.width).toBeGreaterThan(ramp[0]!.width)
    // Each step of the ramp is narrower and more opaque than the one before.
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i]!.width).toBeLessThan(ramp[i - 1]!.width)
      expect(ramp[i]!.alpha).toBeGreaterThan(ramp[i - 1]!.alpha)
    }
  })

  it('draws the tracks in the accent on dark, and its own ramp on light', () => {
    expect(heatPasses('dark', '#2dd4a7').map((p) => p.color)).toEqual(['rgba(45,212,167,0.035)', 'rgba(45,212,167,0.16)'])
    const { light, deep } = heatRamp('#0e7f9b')
    const passes = heatPasses('light', '#0e7f9b')
    expect(passes.map((p) => p.color)).toEqual([rgba(light, 0.09), rgba(light, 0.2), rgba('#0e7f9b', 0.34), rgba(deep, 0.46)])
    expect(passes[0]!.blur).toBe(6)
    expect(passes.slice(1).every((p) => p.blur === undefined)).toBe(true)
  })

  // 3.0 override 9: added light stacks, so enough runs over one street summed
  // to white. The canvas washes the accent back over what it drew, which caps
  // the busiest ground at the accent; heatLayer applies it with source-atop.
  it('caps the dark canvas at the accent rather than letting it reach white', () => {
    expect(HEAT_DARK_CAP_ALPHA).toBeGreaterThan(0)
    expect(HEAT_DARK_CAP_ALPHA).toBeLessThan(1)
  })

  it('reads a short hex too', () => {
    expect(rgba('#fff', 0.5)).toBe('rgba(255,255,255,0.5)')
  })
})

describe('heatLineWidth (v4.17)', () => {
  it('holds 1.2 px out to zoom 12, reaches 4 px at 16, straight between', () => {
    expect(heatLineWidth(8)).toBe(1.2)
    expect(heatLineWidth(12)).toBe(1.2)
    expect(heatLineWidth(14)).toBeCloseTo(2.6, 10)
    expect(heatLineWidth(16)).toBe(4)
    expect(heatLineWidth(19)).toBe(4)
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

  // Three runs from the same door: 1 km, 2 km and 5 km out, due east.
  const east = (km: number): [number, number][] => [[7.75, 48.58], [7.75 + km / (111.32 * Math.cos((48.58 * Math.PI) / 180)), 48.58], [7.75, 48.58]]
  const routeMeta = [meta(), meta(), meta({ year: '2025' })]
  const routes = [east(1), east(2), east(5)]

  it('puts home where the runs start and the reach at the median furthest point (v4.17)', () => {
    const territory = computeAreaTerritory(cluster('a', [0, 1, 2]), routeMeta, routes, { year: null, type: null })!
    expect(territory.home).toEqual([7.75, 48.58])
    // Half the runs - two of three - never go past 2 km.
    expect(territory.medianReachKm).toBe(2)
  })

  it('reads the reach from the runs the filters keep', () => {
    const territory = computeAreaTerritory(cluster('a', [0, 1, 2]), routeMeta, routes, { year: '2025', type: null })!
    expect(territory.medianReachKm).toBe(5)
    expect(territory.routeCount).toBe(1)
  })

  it('has no card until the area\'s routes have arrived', () => {
    expect(computeAreaTerritory(cluster('a', [0, 1, 2]), routeMeta, [], { year: null, type: null })).toBeNull()
  })
})
