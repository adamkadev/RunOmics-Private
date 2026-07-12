import { describe, it, expect } from 'vitest'
import { sumDistanceKm, yearDistanceKm } from '../distance'

const act = (date: string, distanceKm: number) => ({ date, distanceKm })

describe('sumDistanceKm', () => {
  it('rounds the total once, not each part', () => {
    // Three 0.4 km parts sum to 1.2 -> 1. Rounding each part first would give 0.
    expect(sumDistanceKm([act('2026-01-01', 0.4), act('2026-01-02', 0.4), act('2026-01-03', 0.4)])).toBe(1)
  })

  it('does not double-round a fractional total up', () => {
    // 1096.46 -> round once = 1096. Rounding to 1 decimal (1096.5) then to int
    // would wrongly give 1097 - the exact Progress/Analytics divergence.
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
    // 2026 only: 5.3 + 4.4 = 9.7 -> 10
    expect(yearDistanceKm(acts, 2026)).toBe(10)
  })
})
