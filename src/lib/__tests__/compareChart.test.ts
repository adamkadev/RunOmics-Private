import { describe, expect, it } from 'vitest'
import { buildCompareSeries } from '@/lib/compareChart'

describe('buildCompareSeries', () => {
  it('truncates the shared axis to the shorter activity distance', () => {
    const series = buildCompareSeries([0, 10], 10, [0, 20], 20, 3)
    expect(series.map((p) => p.d)).toEqual([0, 5, 10])
  })

  it('linearly interpolates each activity onto the shared axis', () => {
    const series = buildCompareSeries([0, 10], 10, [100, 200], 10, 3)
    expect(series).toEqual([
      { d: 0, a: 0, b: 100 },
      { d: 5, a: 5, b: 150 },
      { d: 10, a: 10, b: 200 },
    ])
  })

  it('returns an empty series when an activity has zero distance', () => {
    expect(buildCompareSeries([1, 2], 0, [1, 2], 5)).toEqual([])
  })
})
