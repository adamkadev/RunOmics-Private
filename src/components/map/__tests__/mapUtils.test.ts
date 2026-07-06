import { describe, it, expect } from 'vitest'
import {
  matchesFilters,
  buildHeatGeoJSON,
  heatColorExpression,
  type HeatFilters,
} from '../mapUtils'
import type { RouteMeta } from '@/application/usecases/GetAllRoutes'

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
  it('counts a shared stretch as run twice', () => {
    // Two routes covering the same two-segment stretch.
    const routes: [number, number][][] = [
      [[7.7, 48.6], [7.701, 48.6], [7.702, 48.6]],
      [[7.7, 48.6], [7.701, 48.6], [7.702, 48.6]],
    ]
    const { data, maxCount } = buildHeatGeoJSON(routes, [0, 1])
    expect(maxCount).toBe(2)
    // Both segments merged into two unique features, each with count 2.
    expect(data.features).toHaveLength(2)
    for (const feat of data.features) {
      expect(feat.properties?.count).toBe(2)
    }
  })

  it('treats opposite directions as the same segment', () => {
    const routes: [number, number][][] = [
      [[7.7, 48.6], [7.701, 48.6]],
      [[7.701, 48.6], [7.7, 48.6]],
    ]
    const { data, maxCount } = buildHeatGeoJSON(routes, [0, 1])
    expect(data.features).toHaveLength(1)
    expect(maxCount).toBe(2)
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
    // ['interpolate', ['linear'], ['get','count'], stop0, color0, ...]
    expect(expr[0]).toBe('interpolate')
    expect(expr[3]).toBe(1) // first stop is always count = 1
    expect(expr[expr.length - 2]).toBe(10) // last stop reaches maxCount
  })

  it('spaces stops logarithmically so mid colours fall on low counts', () => {
    // With a right-skewed max of 100, a linear ramp would put the 2nd/3rd stops at
    // ~35/~65; log spacing must place them far lower so the bulk of (low-count)
    // segments still pick up warm colour instead of all reading "rare".
    const expr = heatColorExpression(100)
    const secondStop = expr[5] as number // count breakpoint for the 2nd colour
    const thirdStop = expr[7] as number
    expect(secondStop).toBeLessThan(10)
    expect(thirdStop).toBeLessThan(30)
    // Still strictly ascending overall.
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
