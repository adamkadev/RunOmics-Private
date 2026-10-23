import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { shoeProjection, shoeWearCopy } from '../shoeWear'

describe('shoeWearCopy', () => {
  it('states the overrun past the limit, with thousands separators', () => {
    const wear = shoeWearCopy({ totalKm: 1_375, maxKm: 500 })

    expect(wear.over).toBe(true)
    expect(wear.ratio).toBe(t.shoes.kmOf('1,375', '500'))
    expect(wear.exact).toBe(t.shoes.pastLimit('875', '500'))
    expect(wear.short).toBe(t.shoes.kmOver('875'))
  })

  it('counts what is left inside the limit', () => {
    const wear = shoeWearCopy({ totalKm: 380, maxKm: 500 })

    expect(wear.over).toBe(false)
    expect(wear.exact).toBe(t.shoes.kmLeftExact('120'))
  })

  it('never says "about 0 more weeks"', () => {
    expect(t.shoes.detail.verdict.weeksLeft(0)).not.toMatch(/\b0\b/)
    expect(t.shoes.detail.verdict.weeksLeft(1)).toContain('1 more week')
  })
})

describe('shoeProjection', () => {
  const NOW = new Date(2026, 9, 19, 12)
  const pair = { retired: false, kmPerWeek: 25.2, maxKm: 1000 }

  it('reads the limit, the month it is reached, and the weeks at the rate', () => {
    expect(shoeProjection(pair, 11, NOW)).toBe(t.shoes.detail.projectedRunOut(25, '1,000', 'Jan ’27', 11))
    expect(t.shoes.detail.projectedRunOut(25, '1,000', 'Jan ’27', 11)).toBe('1,000 km ≈ Jan ’27 · 11 wk at 25 km/wk')
  })

  it('drops the date past a year out', () => {
    expect(shoeProjection(pair, 60, NOW)).toBe(t.shoes.detail.projectedRunOutFar(25, '1,000'))
  })

  it('has none for a retired pair or one with no rate', () => {
    expect(shoeProjection({ ...pair, retired: true }, 11, NOW)).toBeNull()
    expect(shoeProjection(pair, null, NOW)).toBeNull()
    expect(shoeProjection(pair, 0, NOW)).toBeNull()
  })
})
