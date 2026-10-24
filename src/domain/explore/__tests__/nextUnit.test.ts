import { describe, it, expect } from 'vitest'
import { NEXT_MAX_KM, NEXT_MIN_CELLS, nextUnit } from '../nextUnit'
import { unitState } from '../coverage'
import type { UnitCoverage } from '../types'

function unit(
  id: string,
  pct: number,
  distanceKm: number | null,
  total = 20,
  name = id,
  kind: UnitCoverage['kind'] = 'quartier',
): UnitCoverage {
  return {
    id,
    name,
    kind,
    commune: 'Testville',
    label: [0, 0],
    visited: Math.floor((pct * total) / 100),
    total,
    pct,
    state: unitState(pct),
    kmRun: 0,
    lastRunDate: null,
    distanceKm,
  }
}

describe('nextUnit', () => {
  it('goes to the nearest unfinished quartier, an untouched one before a half-done one farther away', () => {
    expect(nextUnit([unit('far-half', 50, 2.5), unit('near-fog', 0, 1)])?.id).toBe('near-fog')
    expect(nextUnit([unit('far-fog', 0, 4.8), unit('near-half', 50, 0.5), unit('mid-low', 20, 1.5)])?.id).toBe('near-half')
  })

  it('skips complete units, small units and units beyond 5 km while a candidate is left', () => {
    const units = [
      unit('done', 95, 0.2),
      unit('tiny', 0, 0.2, NEXT_MIN_CELLS - 1),
      unit('far', 0, NEXT_MAX_KM + 0.1),
      unit('fallback-free', 80, 4),
    ]

    expect(nextUnit(units)?.id).toBe('fallback-free')
  })

  it('takes a unit exactly 5 km away with exactly 5 cells', () => {
    expect(nextUnit([unit('edge', 60, NEXT_MAX_KM, NEXT_MIN_CELLS), unit('far', 0, 6)])?.id).toBe('edge')
  })

  it('at the same distance takes the more explored, then the name', () => {
    expect(nextUnit([unit('fog', 20, 1), unit('half', 60, 1.05)])?.id).toBe('half')
    expect(nextUnit([unit('x2', 30, 1, 20, 'Zeta'), unit('x1', 30, 1, 20, 'Alpha')])?.id).toBe('x1')
  })

  it('falls back to the nearest unfinished unit when none is a candidate', () => {
    const units = [unit('far-low', 10, 9), unit('far-lower', 0, 12), unit('small', 0, 1, 3), unit('done', 100, 1)]

    expect(nextUnit(units)?.id).toBe('small')
    expect(nextUnit(units.filter((u) => u.id !== 'small'))?.id).toBe('far-low')
  })

  it('only considers units with no known distance in the fallback', () => {
    expect(nextUnit([unit('unknown', 0, null), unit('known', 70, 2)])?.id).toBe('known')
    expect(nextUnit([unit('u1', 40, null), unit('u2', 10, null)])?.id).toBe('u1')
  })

  it('suggests a nearby quartier before a nearby commune that scores better', () => {
    const units = [unit('village', 4, 2.4, 109, 'Plappeville', 'commune'), unit('quartier', 0, 3, 50)]

    // 0.44 for the commune, 0.5 for the quartier.
    expect(nextUnit(units)?.id).toBe('quartier')
  })

  it('suggests a commune when no quartier is a candidate', () => {
    const units = [unit('village', 4, 2.4, 109, 'Plappeville', 'commune'), unit('done', 95, 1), unit('far', 0, 9)]

    expect(nextUnit(units)?.id).toBe('village')
  })

  it('is null when every unit is complete, or there is none', () => {
    expect(nextUnit([unit('a', 90, 1), unit('b', 100, 2)])).toBeNull()
    expect(nextUnit([])).toBeNull()
  })
})
