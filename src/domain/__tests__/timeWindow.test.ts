import { describe, it, expect } from 'vitest'
import { lineInterpolation } from '../timeWindow'

describe('lineInterpolation', () => {
  it('keeps straight segments up to six points', () => {
    expect(lineInterpolation(2)).toBe('linear')
    expect(lineInterpolation(6)).toBe('linear')
  })

  it('splines only a series dense enough to justify one', () => {
    expect(lineInterpolation(7)).toBe('monotone')
    expect(lineInterpolation(28)).toBe('monotone')
  })
})
