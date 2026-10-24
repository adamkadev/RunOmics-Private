import { describe, expect, it } from 'vitest'
import { recoveryAverage, repSet, trackDomain, trackPosition } from '../repSet'
import type { ActivitySplit } from '../types'

const split = (
  type: ActivitySplit['type'],
  durationSec: number,
  distanceM: number,
  avgHr: number | null = null,
): ActivitySplit => ({ type, durationSec, distanceM, avgSpeedMs: distanceM / durationSec, avgHr, laps: [] })

/** 300m in 60s is 3:20/km, the pace the fixtures below vary around. */
const rep = (durationSec: number, avgHr: number | null = null) =>
  split('interval_active', durationSec, 300, avgHr)

describe('repSet', () => {
  it('folds each recovery into the rep it follows', () => {
    const set = repSet([
      split('interval_warmup', 900, 2520),
      rep(60, 174),
      split('interval_recovery', 89, 140, 163),
      rep(61, 172),
      split('interval_recovery', 89, 120, 164),
      split('interval_cooldown', 648, 1720),
    ])

    expect(set?.reps).toHaveLength(2)
    expect(set?.reps[0]?.recovery).toMatchObject({ durationSec: 89, distanceM: 140, avgHr: 163 })
    expect(set?.warmups.map((s) => s.distanceM)).toEqual([2520])
    expect(set?.cooldowns.map((s) => s.distanceM)).toEqual([1720])
  })

  it('leaves the last rep without a recovery when the set ends on the work', () => {
    const set = repSet([rep(60), split('interval_recovery', 89, 140), rep(60)])

    expect(set?.reps[1]?.recovery).toBeNull()
  })

  it('builds the band from the reps own median, and counts what sits inside it', () => {
    const set = repSet([rep(60), rep(60), rep(75)])

    // Median 300m/60s is 200 s/km, so the band runs 190-210.
    expect(set?.band).toEqual({ min: 190, max: 210 })
    expect(set?.inBand).toBe(2)
    expect(set?.spreadSecPerKm).toBe(50)
  })

  it('averages the recoveries between reps and leaves the cooldown out of it', () => {
    const set = repSet([
      rep(60),
      split('interval_recovery', 120, 250),
      rep(60),
      split('interval_recovery', 120, 300),
      split('interval_cooldown', 600, 2000),
    ])

    expect(recoveryAverage(set!.reps)?.paceSecPerKm).toBe(436)
  })

  it('reads heart-rate drift across the reps, first to last', () => {
    const set = repSet([rep(60, 174), rep(60, 170), rep(60, 167)])

    expect(set?.hrDriftBpm).toBe(-7)
  })

  it('moves an untyped lead-in lap out of the set and into the warm-up row', () => {
    // 5:40/km in front of a set run at 4:00-3:32: a lead-in, whatever the watch typed it.
    const set = repSet([rep(102), rep(72), rep(71), rep(64), rep(64)])

    expect(set?.reps).toHaveLength(4)
    expect(set?.reps[0]?.number).toBe(1)
    expect(set?.reps[0]?.paceSecPerKm).toBe(240)
    expect(set?.warmups.map((s) => s.durationSec)).toEqual([102])
  })

  it('reads an easy run before its strides as the run and its strides, not a warm-up and a set', () => {
    const strides = Array.from({ length: 6 }, () => [split('interval_active', 20, 95, 155), split('interval_recovery', 60, 160)]).flat()
    const set = repSet([split('interval_active', 2900, 8000, 142), ...strides])

    expect(set?.body?.distanceM).toBe(8000)
    expect(set?.warmups).toEqual([])
    expect(set?.reps).toHaveLength(6)
    expect(set?.reps[0]?.number).toBe(1)
    expect(set?.strides).toBe(true)
  })

  it('keeps every part of a warm-up, in order', () => {
    const set = repSet([split('interval_warmup', 600, 1700), split('interval_warmup', 299, 1000), split('interval_warmup', 286, 1000), rep(60), rep(60)])

    expect(set?.warmups.map((s) => s.distanceM)).toEqual([1700, 1000, 1000])
  })

  it('keeps a merely slower opener, which is still part of the work', () => {
    const set = repSet([rep(63), rep(60), rep(60), rep(60)])

    expect(set?.reps).toHaveLength(4)
  })

  it('is not a rep set below two work intervals', () => {
    expect(repSet([split('interval_warmup', 600, 2000), rep(60)])).toBeNull()
    expect(repSet(null)).toBeNull()
  })
})

describe('trackDomain', () => {
  it('spans every rep and the whole band, so the band can be drawn inside it', () => {
    const set = repSet([rep(60), rep(60), rep(75)])
    const track = trackDomain(set!)

    // Reps run 200-250 s/km and the band is 190-210, so the track covers 190-250 padded.
    expect(track).toEqual({ slow: 254, fast: 186 })
  })

  it('leaves a rep that ran outside the band short of it, not off the track', () => {
    const set = repSet([rep(60), rep(60), rep(75)])
    const track = trackDomain(set!)!
    const band = set!.band!

    const slowRep = trackPosition(250, track)
    const bandSlowEdge = trackPosition(band.max, track)

    expect(slowRep).toBeGreaterThan(0)
    expect(slowRep).toBeLessThan(bandSlowEdge)
  })
})

describe('trackPosition', () => {
  const track = { slow: 250, fast: 200 }

  it('puts the fast end at one and the slow end at zero', () => {
    expect(trackPosition(200, track)).toBe(1)
    expect(trackPosition(250, track)).toBe(0)
    expect(trackPosition(225, track)).toBe(0.5)
  })

  it('clamps anything beyond the track', () => {
    expect(trackPosition(150, track)).toBe(1)
    expect(trackPosition(300, track)).toBe(0)
  })
})
