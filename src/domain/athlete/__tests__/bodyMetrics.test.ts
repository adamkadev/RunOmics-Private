import { describe, expect, it } from 'vitest'
import { bmiBand, fitnessAgeBand, fitnessAgeDeltaYears } from '../bodyMetrics'

describe('bmiBand', () => {
  it('maps the WHO adult cutoffs', () => {
    expect(bmiBand(17)).toBe('underweight')
    expect(bmiBand(20.7)).toBe('healthy')
    expect(bmiBand(27)).toBe('overweight')
    expect(bmiBand(32)).toBe('obese')
  })

  it('puts each boundary in the band it opens', () => {
    expect(bmiBand(18.5)).toBe('healthy')
    expect(bmiBand(25)).toBe('overweight')
    expect(bmiBand(30)).toBe('obese')
  })
})

describe('fitnessAgeBand', () => {
  it('reads a lower fitness age as younger', () => {
    expect(fitnessAgeBand(22, 29)).toBe('younger')
  })

  it('reads a higher fitness age as older', () => {
    expect(fitnessAgeBand(34, 29)).toBe('older')
  })

  it('treats a sub-year gap either way as on par', () => {
    expect(fitnessAgeBand(29, 29)).toBe('onPar')
    expect(fitnessAgeBand(28.5, 29)).toBe('onPar')
    expect(fitnessAgeBand(29.5, 29)).toBe('onPar')
  })
})

describe('fitnessAgeDeltaYears', () => {
  it('reports whole years, unsigned - the band already carries the direction', () => {
    expect(fitnessAgeDeltaYears(21.97, 29)).toBe(7)
    expect(fitnessAgeDeltaYears(34.2, 29)).toBe(5)
  })
})
