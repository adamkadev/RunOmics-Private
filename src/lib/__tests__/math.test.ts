import { describe, expect, it } from 'vitest'
import { round } from '@/lib/math'

describe('round', () => {
  it('rounds to 1 decimal by default', () => {
    expect(round(1.2345)).toBe(1.2)
  })

  it('rounds to the given number of decimals', () => {
    expect(round(1.2345, 2)).toBe(1.23)
  })

  it('rounds to whole numbers when decimals is 0', () => {
    expect(round(1.5, 0)).toBe(2)
  })

  it('handles negative numbers', () => {
    expect(round(-1.26, 1)).toBe(-1.3)
  })
})
