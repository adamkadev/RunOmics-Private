import { describe, it, expect } from 'vitest'
import { NEXT_KM_PER_POINT, NEXT_MAX_KM, NEXT_MIN_CELLS, nextUnit, nextUnitScore } from '../nextUnit'
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

describe('nextUnitScore', () => {
  it('is pct/100 + km/6', () => {
    expect(nextUnitScore({ pct: 40, distanceKm: 3 })).toBeCloseTo(0.9, 12)
    expect(nextUnitScore({ pct: 0, distanceKm: 0 })).toBe(0)
    expect(NEXT_KM_PER_POINT).toBe(6)
  })

  it('scores an unknown distance on coverage alone', () => {
    expect(nextUnitScore({ pct: 25, distanceKm: null })).toBe(0.25)
  })
})

describe('nextUnit', () => {
  it('picks the lowest score among nearby incomplete units', () => {
    const units = [unit('far-fog', 0, 4.8), unit('near-half', 50, 0.5), unit('mid-low', 20, 1.5)]

    // 0.8, 0.583, 0.45
    expect(nextUnit(units)?.id).toBe('mid-low')
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

  it('breaks a tie on score by distance, then by name', () => {
    // 0.4 + 0.6/6 and 0.3 + 1.2/6 are both 0.5, give or take a rounding.
    expect(nextUnit([unit('b', 30, 1.2), unit('a', 40, 0.6)])?.id).toBe('a')
    expect(nextUnit([unit('x2', 30, 1, 20, 'Zeta'), unit('x1', 30, 1, 20, 'Alpha')])?.id).toBe('x1')
  })

  it('falls back to the lowest score among every incomplete unit when none is near', () => {
    const units = [unit('far-low', 10, 9), unit('far-lower', 0, 12), unit('small', 0, 1, 3), unit('done', 100, 1)]

    // 10/100 + 9/6 = 1.6, 0 + 12/6 = 2, the small one: 0 + 1/6.
    expect(nextUnit(units)?.id).toBe('small')
    expect(nextUnit(units.filter((u) => u.id !== 'small'))?.id).toBe('far-low')
  })

  it('only considers units with no known distance in the fallback', () => {
    expect(nextUnit([unit('unknown', 0, null), unit('known', 70, 2)])?.id).toBe('known')
    expect(nextUnit([unit('u1', 40, null), unit('u2', 10, null)])?.id).toBe('u2')
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
