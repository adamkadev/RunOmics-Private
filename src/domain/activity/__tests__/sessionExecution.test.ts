import { describe, expect, it } from 'vitest'
import { repStats, sessionExecution } from '../sessionExecution'
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

    expect(result).toEqual({
      kind: 'intervals',
      reps: 3,
      repPaces: [240, 250, 270],
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

    // Second half 340.5 s/km against 330.5: 10 s/km of fade.
    expect(result).toEqual({ kind: 'steady', spreadSecPerKm: 15, fadeSecPerKm: 10, hrDriftBpm: 11 })
  })

  it('ignores a final partial kilometre, which is short rather than fast', () => {
    const evenLaps = [lap(330), lap(332), lap(331), lap(333)]
    const withStub = sessionExecution({ splits: [split('interval_active', 1400, 4200, null, [...evenLaps, lap(90, 300)])] })

    expect(withStub).toMatchObject({ spreadSecPerKm: 3 })
  })

  it('reads strides after an easy block as strides, and the block as a steady run', () => {
    const easy = split('interval_active', 2963, 8500, 151, [lap(348), lap(347), lap(349), lap(350), lap(346)])
    const stride = (seconds: number) => split('interval_active', 20, (20 / seconds) * 1000, 160)
    const result = sessionExecution({ splits: [easy, stride(208), split('interval_recovery', 60, 158), stride(213), stride(203)] })

    expect(result).toMatchObject({ kind: 'steady', strides: { count: 3, fastestSecPerKm: 203, slowestSecPerKm: 213 } })
  })

  it('keeps short reps with no continuous block as the session - sprints', () => {
    const sprint = () => split('interval_active', 15, 90)
    const result = sessionExecution({ splits: [split('interval_warmup', 600, 2000), sprint(), sprint(), sprint(), split('interval_cooldown', 600, 2000)] })

    expect(result).toMatchObject({ kind: 'intervals', reps: 3 })
    expect(result).not.toHaveProperty('strides')
  })

  it('reads threshold reps as the reps, and strides after them as strides', () => {
    const rep = (seconds: number) => split('interval_active', 420, (420 / seconds) * 1000, 176)
    const result = sessionExecution({ splits: [rep(265), rep(265), rep(264), split('interval_active', 20, 95)] })

    expect(result).toMatchObject({ kind: 'intervals', reps: 3, repPaces: [265, 265, 264], strides: { count: 1 } })
  })

  it('averages the reps of a structured session for a rep-to-rep comparison', () => {
    const rep = (hr: number) => split('interval_active', 420, 1585, hr)
    expect(repStats({ splits: [split('interval_warmup', 732, 2000, 147), rep(175), rep(178), rep(179)] })).toEqual({ reps: 3, secondsPerRep: 420, paceSecPerKm: 265, avgHr: 177 })
    expect(repStats({ splits: [split('interval_active', 2963, 8500)] })).toBeNull()
  })

  it('returns null when there is nothing to read', () => {
    expect(sessionExecution({ splits: null })).toBeNull()
    expect(sessionExecution({ splits: [split('interval_warmup', 600, 2000)] })).toBeNull()
    expect(sessionExecution({ splits: [split('interval_active', 1000, 3000, null, [lap(330), lap(332)])] })).toBeNull()
  })
})
