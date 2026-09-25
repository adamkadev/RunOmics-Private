import { describe, expect, it } from 'vitest'
import { formBand } from '../formBand'

describe('formBand', () => {
  it('names where Form sits', () => {
    expect(formBand(-15)).toBe('tired')
    expect(formBand(-10)).toBe('neutral')
    expect(formBand(2)).toBe('neutral')
    expect(formBand(5)).toBe('neutral')
    expect(formBand(6)).toBe('fresh')
    expect(formBand(25)).toBe('fresh')
    expect(formBand(26)).toBe('veryFresh')
  })
})
