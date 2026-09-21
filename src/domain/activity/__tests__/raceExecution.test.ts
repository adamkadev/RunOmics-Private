import { describe, expect, it } from 'vitest'
import { raceExecution } from '../raceExecution'
import type { Activity, ActivitySplit } from '../types'

const lap = (durationSec: number, distanceM: number, avgHr: number | null): ActivitySplit => ({
  type: 'lap',
  durationSec,
  distanceM,
  avgSpeedMs: distanceM / durationSec,
  avgHr,
  laps: [],
})

const escherSplits: ActivitySplit[] = [
  lap(236, 1_000, 191),
  lap(245, 1_000, 196),
  lap(249, 1_000, 199),
  lap(253, 1_000, 197),
  lap(255, 1_000, 198),
  lap(71, 248.6, 197),
]

const race = (splits: ActivitySplit[] | null, type: Activity['type'] = 'Race') =>
  ({ type, splits }) as Pick<Activity, 'type' | 'splits'>

describe('raceExecution', () => {
  it('exposes the full-kilometre pacing progression from the real laps', () => {
    const execution = raceExecution(race(escherSplits))

    expect(execution?.fullLaps.map((entry) => entry.paceSecPerKm)).toEqual([236, 245, 249, 253, 255])
    expect(execution?.fullLaps.map((entry) => entry.avgHr)).toEqual([191, 196, 199, 197, 198])
  })

  it('keeps the closing part-lap separate from the full laps', () => {
    const execution = raceExecution(race(escherSplits))

    expect(execution?.fullLaps).toHaveLength(5)
    expect(execution?.partialLap).toEqual({
      distanceMeters: 248.6,
      durationSeconds: 71,
      paceSecPerKm: 286,
      avgHr: 197,
    })
  })

  it('computes the pacing trend from full laps only', () => {
    const execution = raceExecution(race(escherSplits))

    expect(execution?.trend).toEqual({
      firstFullLapPaceSecPerKm: 236,
      lastFullLapPaceSecPerKm: 255,
      positiveSplitSecPerKm: 19,
      fastestFullLapPaceSecPerKm: 236,
      slowestFullLapPaceSecPerKm: 255,
      firstFullLapAvgHr: 191,
      lastFullLapAvgHr: 198,
      hrDriftBpm: 7,
    })
  })

  it('never lets the slower part-lap distort the trend', () => {
    const execution = raceExecution(race(escherSplits))

    expect(execution?.trend.slowestFullLapPaceSecPerKm).toBe(255)
    expect(execution?.trend.slowestFullLapPaceSecPerKm).not.toBe(execution?.partialLap?.paceSecPerKm)
  })

  it('reports no partial lap when the race ends on a full lap', () => {
    expect(raceExecution(race(escherSplits.slice(0, 5)))?.partialLap).toBeNull()
  })

  it('ignores activities that are not races', () => {
    expect(raceExecution(race(escherSplits, 'Base'))).toBeNull()
  })

  it('returns null without real lap splits', () => {
    expect(raceExecution(race(null))).toBeNull()
    expect(raceExecution(race([]))).toBeNull()
  })

  it('does not read interval splits, which belong to sessionExecution', () => {
    const intervals = escherSplits.map((split) => ({ ...split, type: 'interval_active' as const }))
    expect(raceExecution(race(intervals))).toBeNull()
  })

  it('needs at least two full laps before reporting a trend', () => {
    expect(raceExecution(race([lap(236, 1_000, 191), lap(71, 248.6, 197)]))).toBeNull()
  })
})
