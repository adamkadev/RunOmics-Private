import { describe, it, expect } from 'vitest'
import { EVEN_SPLIT_SEC, halfSplitSec, kmElevationDeltas, kmSplitsFromLaps, kmSplitsFromSamples, kmSplitsOf } from '../kmSplits'

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

describe('kmSplitsFromSamples calibration', () => {
  it('scales the derived splits so they add up to the run that was actually run', () => {
    const samples = Array.from({ length: 101 }, () => 300)
    const splits = kmSplitsFromSamples({
      distanceKm: 5,
      durationSec: 1550,
      paceSamples: samples,
      hrSamples: null,
      avgPaceSecPerKm: 310,
    })

    const total = splits.reduce((sum, s) => sum + s.durationSec, 0)
    expect(total).toBe(1550)
    expect(splits.every((s) => s.paceSecPerKm === 310)).toBe(true)
  })

  it('leaves the samples alone when the run has no duration to calibrate against', () => {
    const splits = kmSplitsFromSamples({
      distanceKm: 5,
      paceSamples: Array.from({ length: 101 }, () => 300),
      hrSamples: null,
      avgPaceSecPerKm: 300,
    })

    expect(splits.reduce((sum, s) => sum + s.durationSec, 0)).toBe(1500)
  })
})

describe('kmElevationDeltas', () => {
  const km = (distanceKm = 1) => ({ distanceKm })

  it("reads each km's climb from the stream laid over the distance", () => {
    // 0 m at the start, 20 m at km 2, back to 10 m at the 3 km finish.
    expect(kmElevationDeltas([km(), km(), km()], [0, 10, 20, 10], 3)).toEqual([10, 10, -10])
  })

  it('takes a partial last km for what it is', () => {
    expect(kmElevationDeltas([km(), km(0.5)], [100, 110, 115, 116], 1.5)).toEqual([15, 1])
  })

  it('reads across a gap from the side it has, and nothing without a stream', () => {
    expect(kmElevationDeltas([km(), km()], [0, null, 20], 2)).toEqual([20, 0])
    expect(kmElevationDeltas([km(), km()], null, 2)).toEqual([null, null])
  })
})

// Garmin's 1 km auto laps, then a 46 m lap press and the last 968 m.
const OCT7_LAPS = [
  { durationSec: 362, distanceM: 1000, avgHr: 130 },
  { durationSec: 358, distanceM: 1000, avgHr: 139 },
  { durationSec: 359, distanceM: 1000, avgHr: 142 },
  { durationSec: 363, distanceM: 1000, avgHr: 142 },
  { durationSec: 355, distanceM: 1000, avgHr: 147 },
  { durationSec: 356, distanceM: 1000, avgHr: 148 },
  { durationSec: 359, distanceM: 1000, avgHr: 147 },
  { durationSec: 360, distanceM: 1000, avgHr: 149 },
  { durationSec: 362, distanceM: 1000, avgHr: 149 },
  { durationSec: 16, distanceM: 46, avgHr: 150 },
  { durationSec: 344, distanceM: 967.9, avgHr: 151 },
]

describe('kmSplitsFromLaps', () => {
  it("reads each kilometre off the watch's laps, interpolating inside the lap that crosses it", () => {
    const splits = kmSplitsFromLaps(OCT7_LAPS, 10.01)
    expect(splits.map((s) => s.paceSecPerKm)).toEqual([362, 358, 359, 363, 355, 356, 359, 360, 362, 355])
    // 46 m in 16 s, then 954 m of the last lap at 344 s / 967.9 m.
    expect(splits.at(-1)).toMatchObject({ km: 10, distanceKm: 1, durationSec: 355, avgHr: 151 })
    // The last 14 m is not a kilometre (under 50 m): the run's other 3589 s.
    expect(splits).toHaveLength(10)
    expect(splits.reduce((sum, s) => sum + s.durationSec, 0)).toBe(3589)
  })

  it('weights a kilometre\'s heart rate by the time it spent in each lap', () => {
    const splits = kmSplitsFromLaps([
      { durationSec: 150, distanceM: 500, avgHr: 140 },
      { durationSec: 450, distanceM: 1500, avgHr: 160 },
    ], 2)
    expect(splits[0]).toMatchObject({ durationSec: 300, avgHr: 150 })
    expect(splits[1]).toMatchObject({ durationSec: 300, avgHr: 160 })
  })

  it('puts a stop lap with no distance into the kilometre it happened in', () => {
    const splits = kmSplitsFromLaps([
      { durationSec: 300, distanceM: 1000, avgHr: null },
      { durationSec: 30, distanceM: 0, avgHr: null },
      { durationSec: 300, distanceM: 1000, avgHr: null },
    ], 2)
    expect(splits.map((s) => s.durationSec)).toEqual([300, 330])
  })

  it('leaves laps that do not cover the run to the samples', () => {
    expect(kmSplitsFromLaps(OCT7_LAPS.slice(0, 5), 10.01)).toEqual([])
    expect(kmSplitsFromLaps([{ durationSec: 600, distanceM: 2000, avgHr: null }], 2)).toEqual([])
  })
})

describe('kmSplitsOf', () => {
  it('prefers the laps and falls back to the samples without them', () => {
    const input = { distanceKm: 10.01, durationSec: 3593, paceSamples: evenSamples(151, 359), hrSamples: null, avgPaceSecPerKm: 359 }
    expect(kmSplitsOf({ ...input, laps: OCT7_LAPS })[9]!.paceSecPerKm).toBe(355)
    expect(kmSplitsOf({ ...input, laps: null })).toEqual(kmSplitsFromSamples(input))
  })
})

describe('kmSplitsFromSamples, stops', () => {
  // A stop and the backfilled start are on the wall clock but not on the timer the splits are scaled to.
  it('leaves stop samples out rather than spreading their time over every km', () => {
    const paceSamples = evenSamples(101, 300)
    paceSamples[0] = 1200
    paceSamples[30] = 950
    const splits = kmSplitsFromSamples({ distanceKm: 5, durationSec: 1500, paceSamples, hrSamples: null, avgPaceSecPerKm: 300 })
    expect(splits.map((s) => s.paceSecPerKm)).toEqual([300, 300, 300, 300, 300])
  })
})

describe('halfSplitSec', () => {
  const km = (durationSec: number, distanceKm = 1) => ({ distanceKm, durationSec })

  it('is negative when the second half is the faster', () => {
    expect(halfSplitSec([km(310), km(300), km(290), km(280)])).toBe(-40)
  })

  it('is positive when the run faded', () => {
    expect(halfSplitSec([km(280), km(290), km(300), km(310)])).toBe(40)
  })

  it('reads the halfway mark inside the km that crosses it', () => {
    // 2.5 km in 720 s: halfway is 1.25 km, reached at 375 s.
    expect(halfSplitSec([km(300), km(300), km(120, 0.5)])).toBe(720 - 2 * 375)
  })

  it('has nothing to halve under two kilometres', () => {
    expect(halfSplitSec([km(300)])).toBeNull()
    expect(halfSplitSec([])).toBeNull()
  })

  it('counts a few seconds either way as even', () => {
    expect(Math.abs(halfSplitSec([km(300), km(302)])!)).toBeLessThan(EVEN_SPLIT_SEC)
  })
})
