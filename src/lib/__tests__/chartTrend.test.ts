import { describe, expect, it } from 'vitest'
import { trendFromSeries } from '@/lib/chartTrend'

describe('trendFromSeries', () => {
  it('returns null when fewer than 4 non-null values are available', () => {
    expect(trendFromSeries([1, 2, null], 0.1)).toBeNull()
  })

  it('ignores null values when computing the trend', () => {
    expect(trendFromSeries([null, 1, 2, null, 3, 4], 0.1)).toEqual({
      direction: 'up',
      delta: 2,
    })
  })

  it('detects an upward trend when the delta exceeds the flat threshold', () => {
    expect(trendFromSeries([1, 1, 2, 2], 0.5)).toEqual({
      direction: 'up',
      delta: 1,
    })
  })

  it('detects a downward trend when the delta is below the negative flat threshold', () => {
    expect(trendFromSeries([2, 2, 1, 1], 0.5)).toEqual({
      direction: 'down',
      delta: -1,
    })
  })

  it('reports flat when the delta is within the threshold', () => {
    expect(trendFromSeries([1, 1, 1, 1], 0.5)).toEqual({
      direction: 'flat',
      delta: 0,
    })
  })
})
