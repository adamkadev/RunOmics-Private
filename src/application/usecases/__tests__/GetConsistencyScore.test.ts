import { describe, it, expect } from 'vitest'
import { stdDev, rating } from '../GetConsistencyScore'

// ---------- stdDev ----------

describe('stdDev', () => {
  it('returns 0 for empty array', () => {
    expect(stdDev([])).toBe(0)
  })

  it('returns 0 for single value', () => {
    expect(stdDev([42])).toBe(0)
  })

  it('returns 0 for uniform values', () => {
    expect(stdDev([10, 10, 10, 10])).toBe(0)
  })

  it('calculates population std dev for [2,4,4,4,5,5,7,9] = 2', () => {
    // mean=5, sum of squared deviations=32, variance=4, std=2
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 10)
  })

  it('calculates correctly for simple case [0, 0, 0, 12]', () => {
    // mean=3, deviations^2=[9,9,9,81], variance=27, std≈5.196
    expect(stdDev([0, 0, 0, 12])).toBeCloseTo(5.196, 2)
  })

  it('handles zeros in the array', () => {
    expect(stdDev([0, 10])).toBeCloseTo(5, 10)
  })
})

// ---------- rating ----------

describe('rating', () => {
  it('excellent at 85', () => {
    expect(rating(85)).toBe('excellent')
    expect(rating(100)).toBe('excellent')
  })

  it('good at 70 up to 84', () => {
    expect(rating(70)).toBe('good')
    expect(rating(84)).toBe('good')
  })

  it('fair at 55 up to 69', () => {
    expect(rating(55)).toBe('fair')
    expect(rating(69)).toBe('fair')
  })

  it('low below 55', () => {
    expect(rating(54)).toBe('low')
    expect(rating(0)).toBe('low')
  })

  it('boundary: 84 is good, 85 is excellent', () => {
    expect(rating(84)).toBe('good')
    expect(rating(85)).toBe('excellent')
  })

  it('boundary: 69 is fair, 70 is good', () => {
    expect(rating(69)).toBe('fair')
    expect(rating(70)).toBe('good')
  })

  it('boundary: 54 is low, 55 is fair', () => {
    expect(rating(54)).toBe('low')
    expect(rating(55)).toBe('fair')
  })
})
