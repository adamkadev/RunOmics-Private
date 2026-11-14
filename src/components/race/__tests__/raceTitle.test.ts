import { describe, expect, it } from 'vitest'
import { titleFit } from '@/components/layout/FitTitle'
import { raceShortName } from '@/components/goals/raceName'

describe('the race title', () => {
  it('steps down to fit, to 28 pt at most, then takes the short name', () => {
    expect(titleFit(320, 34, { glyphs: 300, spacing: 10 }, { glyphs: 200, spacing: 6 })).toEqual({ short: false, px: null })
    expect(titleFit(320, 34, { glyphs: 340, spacing: 10 }, { glyphs: 200, spacing: 6 })).toEqual({ short: false, px: 31 })
    expect(titleFit(320, 34, { glyphs: 500, spacing: 10 }, { glyphs: 200, spacing: 6 })).toEqual({ short: true, px: null })
    expect(titleFit(320, 34, { glyphs: 500, spacing: 10 }, { glyphs: 450, spacing: 6 })).toEqual({ short: true, px: 28 })
  })

  it('names the race by its own distance, without the year or the city', () => {
    expect(raceShortName('Spring Marathon', 'Half-Marathon')).toBe('Spring Half')
    expect(raceShortName('Semi-Marathon de la Ville 2027', 'Half-Marathon')).toBe('Half de la Ville')
    expect(raceShortName('Winter 10K', '10K')).toBe('Winter 10K')
    expect(raceShortName('Spring Marathon Lakeside', 'Half-Marathon', 'Lakeside')).toBe('Spring Half')
  })
})
