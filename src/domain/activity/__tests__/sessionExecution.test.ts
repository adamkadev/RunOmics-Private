import { describe, expect, it } from 'vitest'
import { sessionExecution } from '../sessionExecution'
import type { ActivitySplit, SplitLap } from '../types'

const lap = (durationSec: number, distanceM = 1000, avgHr: number | null = null): SplitLap => ({
  durationSec,
  distanceM,
  avgSpeedMs: distanceM / durationSec,
  avgHr,
})

const split = (
  type: ActivitySplit['type'],
  durationSec: number,
  distanceM: number,
  avgHr: number | null = null,
  laps: SplitLap[] = []
): ActivitySplit => ({ type, durationSec, distanceM, avgSpeedMs: distanceM / durationSec, avgHr, laps })

describe('sessionExecution', () => {
  it('measures the fade and spread across interval reps', () => {
    const result = sessionExecution({
      splits: [
        split('interval_warmup', 600, 2000),
        split('interval_active', 72, 300, 160),
        split('interval_active', 75, 300, 168),
        split('interval_active', 81, 300, 175),
        split('interval_cooldown', 600, 2000),
      ],
    })

    // 240 -> 270 s/km across three 300m reps.
    expect(result).toEqual({
      kind: 'intervals',
      reps: 3,
      fadeSecPerKm: 30,
      spreadSecPerKm: 30,
      hrDriftBpm: 15,
    })
  })

  it('reports a negative fade when the reps got faster', () => {
    const result = sessionExecution({
      splits: [split('interval_active', 81, 300), split('interval_active', 72, 300)],
    })

    expect(result).toMatchObject({ kind: 'intervals', fadeSecPerKm: -30 })
  })

  it('reads a steady run from its kilometre laps', () => {
    const result = sessionExecution({
      splits: [
        split('interval_active', 1342, 4000, 150, [lap(330, 1000, 145), lap(331, 1000, 147), lap(345, 1000, 156), lap(336, 1000, 158)]),
      ],
    })

    expect(result).toEqual({ kind: 'steady', spreadSecPerKm: 15, hrDriftBpm: 11 })
  })

  it('ignores a final partial kilometre, which is short rather than fast', () => {
    const evenLaps = [lap(330), lap(332), lap(331), lap(333)]
    const withStub = sessionExecution({ splits: [split('interval_active', 1400, 4200, null, [...evenLaps, lap(90, 300)])] })

    expect(withStub).toMatchObject({ spreadSecPerKm: 3 })
  })

  it('returns null when there is nothing to read', () => {
    expect(sessionExecution({ splits: null })).toBeNull()
    expect(sessionExecution({ splits: [split('interval_warmup', 600, 2000)] })).toBeNull()
    expect(sessionExecution({ splits: [split('interval_active', 1000, 3000, null, [lap(330), lap(332)])] })).toBeNull()
  })
})
