import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { shoeWearCopy } from '../shoeWear'

describe('shoeWearCopy', () => {
  // 1,375 of 500 km read "0 km left" and "1375 / 500 km".
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
