import { describe, it, expect } from 'vitest'
import { buildSegments, buildSplits, riegel, bestSource } from '../GetRacePacePlan'
import type { RecordEntry } from '../GetRecords'

describe('buildSegments', () => {
  it('splits a whole-km distance into 1km segments', () => {
    expect(buildSegments(5)).toEqual([1, 1, 1, 1, 1])
  })

  it('appends a fractional final segment for a non-integer distance', () => {
    const segs = buildSegments(10.5)
    expect(segs).toHaveLength(11)
    expect(segs[10]).toBeCloseTo(0.5, 5)
  })

  it('does not append a near-zero remainder', () => {
    expect(buildSegments(4.0001)).toHaveLength(4)
  })
})

describe('buildSplits', () => {
  it('even split: every km takes the same time and sums to the target', () => {
    const splits = buildSplits(5, 1500, 0)
    expect(splits).toHaveLength(5)
    expect(splits.every((s) => s.splitSeconds === 300)).toBe(true)
    expect(splits[4]!.cumulativeSeconds).toBe(1500)
  })

  it('negative split: first km is slower and last km is faster than even pace, total unchanged', () => {
    const even = buildSplits(10, 3000, 0)
    const negative = buildSplits(10, 3000, 0.02)
    expect(negative[0]!.splitSeconds).toBeGreaterThan(even[0]!.splitSeconds)
    expect(negative[9]!.splitSeconds).toBeLessThan(even[9]!.splitSeconds)
    expect(negative[9]!.cumulativeSeconds).toBe(3000)
  })

  it('handles a fractional final segment (half marathon) and still sums exactly to target', () => {
    const splits = buildSplits(21.0975, 6000, 0.02)
    expect(splits).toHaveLength(22)
    expect(splits[splits.length - 1]!.cumulativeSeconds).toBe(6000)
  })

  it('cumulative seconds is strictly increasing', () => {
    const splits = buildSplits(10, 3000, 0.02)
    for (let i = 1; i < splits.length; i++) {
      expect(splits[i]!.cumulativeSeconds).toBeGreaterThan(splits[i - 1]!.cumulativeSeconds)
    }
  })
})

describe('riegel', () => {
  it('predicts a slower time over a longer distance', () => {
    expect(riegel(1200, 5, 10)).toBeGreaterThan(2400)
  })
})

describe('bestSource', () => {
  const record = (key: string, seconds: number | null): RecordEntry => ({
    key,
    label: key,
    seconds,
    paceSecPerKm: 0,
    activityId: null,
    date: null,
    official: false,
  })

  it('picks the closest known distance by log-ratio, excluding the target itself', () => {
    const records = [record('5k', 1200), record('marathon', 12600), record('10k', 2500)]
    const result = bestSource('10k', 10, records)
    expect(result?.sourceKm).toBe(5)
  })

  it('ignores records with a null time', () => {
    const records = [record('5k', null)]
    expect(bestSource('10k', 10, records)).toBeNull()
  })

  it('null with no usable records', () => {
    expect(bestSource('10k', 10, [])).toBeNull()
  })
})
