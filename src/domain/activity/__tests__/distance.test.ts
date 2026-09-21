import { describe, it, expect } from 'vitest'
import { sumDistanceKm, yearDistanceKm } from '../distance'

const act = (date: string, distanceKm: number) => ({ date, distanceKm })

describe('sumDistanceKm', () => {
  it('rounds the total once, not each part', () => {
    expect(sumDistanceKm([act('2026-01-01', 0.4), act('2026-01-02', 0.4), act('2026-01-03', 0.4)])).toBe(1)
  })

  it('does not double-round a fractional total up', () => {
    const acts = [act('2026-01-01', 1000), act('2026-01-02', 96.46)]
    expect(sumDistanceKm(acts)).toBe(1096)
  })

  it('returns 0 for an empty set', () => {
    expect(sumDistanceKm([])).toBe(0)
  })
})

describe('yearDistanceKm', () => {
  it('sums only the requested year and rounds once', () => {
    const acts = [
      act('2025-12-31', 10),
      act('2026-01-01', 5.3),
      act('2026-06-15', 4.4),
      act('2027-01-01', 99),
    ]
    expect(yearDistanceKm(acts, 2026)).toBe(10)
  })
})
