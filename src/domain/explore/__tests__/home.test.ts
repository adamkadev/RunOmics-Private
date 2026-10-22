import { describe, it, expect } from 'vitest'
import { medianStart } from '../home'

describe('medianStart', () => {
  it('takes the median longitude and latitude separately', () => {
    expect(
      medianStart([
        [1, 10],
        [3, 30],
        [2, 50],
      ]),
    ).toEqual([2, 30])
  })

  it('averages the middle two of an even count', () => {
    expect(
      medianStart([
        [0, 0],
        [2, 4],
        [10, 8],
        [4, 6],
      ]),
    ).toEqual([3, 5])
  })

  it('is not moved by one far-away start', () => {
    const [lon] = medianStart([[1, 1], [1.001, 1], [1.002, 1], [90, 1]])!

    expect(lon).toBeCloseTo(1.0015, 9)
  })

  it('is null without a usable start', () => {
    expect(medianStart([])).toBeNull()
    expect(medianStart([[Number.NaN, 1]])).toBeNull()
  })
})
