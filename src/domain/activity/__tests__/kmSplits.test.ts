import { describe, it, expect } from 'vitest'
import { kmSplitsFromSamples } from '../kmSplits'

function evenSamples(count: number, pace: number): number[] {
  return Array.from({ length: count }, () => pace)
}

describe('kmSplitsFromSamples', () => {
  it('splits a steady 5 km run into five kilometres at the sampled pace', () => {
    const splits = kmSplitsFromSamples({
      distanceKm: 5,
      paceSamples: evenSamples(101, 300),
      hrSamples: null,
      avgPaceSecPerKm: 300,
    })

    expect(splits).toHaveLength(5)
    expect(splits.map((s) => s.km)).toEqual([1, 2, 3, 4, 5])
    for (const split of splits) {
      expect(split.paceSecPerKm).toBe(300)
      expect(split.durationSec).toBe(300)
      expect(split.distanceKm).toBe(1)
    }
  })

  it('keeps the trailing part-kilometre and prices it at its own pace', () => {
    const splits = kmSplitsFromSamples({
      distanceKm: 2.4,
      paceSamples: evenSamples(241, 300),
      hrSamples: null,
      avgPaceSecPerKm: 300,
    })

    expect(splits).toHaveLength(3)
    expect(splits[2]!.distanceKm).toBeCloseTo(0.4, 2)
    expect(splits[2]!.durationSec).toBe(120)
    expect(splits[2]!.paceSecPerKm).toBe(300)
  })

  it('drops a trailing sliver too short to time honestly', () => {
    const splits = kmSplitsFromSamples({
      distanceKm: 2.01,
      paceSamples: evenSamples(201, 300),
      hrSamples: null,
      avgPaceSecPerKm: 300,
    })

    expect(splits).toHaveLength(2)
  })

  it('tracks a pace that changes across the run', () => {
    const fast = evenSamples(50, 240)
    const slow = evenSamples(51, 360)
    const splits = kmSplitsFromSamples({
      distanceKm: 2,
      paceSamples: [...fast, ...slow],
      hrSamples: null,
      avgPaceSecPerKm: 300,
    })

    expect(splits).toHaveLength(2)
    expect(splits[0]!.paceSecPerKm).toBeLessThan(splits[1]!.paceSecPerKm)
  })

  it('falls back to the average pace where the sample is missing', () => {
    const samples = evenSamples(101, 300)
    samples[40] = 0
    samples[41] = 0
    const splits = kmSplitsFromSamples({
      distanceKm: 5,
      paceSamples: samples,
      hrSamples: null,
      avgPaceSecPerKm: 300,
    })

    expect(splits).toHaveLength(5)
    expect(splits[2]!.paceSecPerKm).toBe(300)
  })

  it('averages heart rate over the kilometre it belongs to', () => {
    const splits = kmSplitsFromSamples({
      distanceKm: 2,
      paceSamples: evenSamples(101, 300),
      hrSamples: [...evenSamples(50, 140), ...evenSamples(51, 170)],
      avgPaceSecPerKm: 300,
    })

    expect(splits[0]!.avgHr).toBeLessThan(splits[1]!.avgHr!)
  })

  it('has nothing to derive without a pace series', () => {
    expect(kmSplitsFromSamples({ distanceKm: 5, paceSamples: null, hrSamples: null, avgPaceSecPerKm: 300 })).toEqual([])
    expect(kmSplitsFromSamples({ distanceKm: 0, paceSamples: evenSamples(10, 300), hrSamples: null, avgPaceSecPerKm: 300 })).toEqual([])
  })
})
