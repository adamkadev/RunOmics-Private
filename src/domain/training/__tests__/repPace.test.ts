import { describe, expect, it } from 'vitest'
import type { ActivitySplit } from '@/domain/activity/types'
import { repPaceSecPerKm } from '../repPace'

const lap = (type: ActivitySplit['type'], km: number, paceSec: number, avgHr: number | null = 150): ActivitySplit => ({
  type,
  distanceM: km * 1000,
  durationSec: km * paceSec,
  avgSpeedMs: 1000 / paceSec,
  avgHr,
  laps: [],
})

describe('rep pace (App Fixes 2b)', () => {
  it('averages only the work laps: 2 km warm-up at 5:50 + 3 × 1.8 km at 4:30 + 2 km cool-down at 5:50 is 4:30', () => {
    const run = {
      splits: [
        lap('interval_warmup', 2, 350),
        lap('interval_active', 1.8, 270, 172),
        lap('interval_recovery', 0.4, 420),
        lap('interval_active', 1.8, 270, 174),
        lap('interval_recovery', 0.4, 420),
        lap('interval_active', 1.8, 270, 175),
        lap('interval_cooldown', 2, 350),
      ],
    }
    expect(repPaceSecPerKm([run])).toBe(270)
  })

  it('counts a plain lap at or over the Z4 floor, never a warm-up, whatever its HR', () => {
    const run = { splits: [lap('lap', 2, 350, 140), lap('lap', 3, 270, 171), lap('interval_warmup', 2, 300, 180)] }
    expect(repPaceSecPerKm([run], 170)).toBe(270)
  })

  it('weights by lap distance', () => {
    const run = { splits: [lap('interval_active', 3, 260), lap('interval_active', 1, 300)] }
    // 780 + 300 s over 4 km.
    expect(repPaceSecPerKm([run])).toBe(270)
  })

  it('leaves out a run without laps, and says nothing when no work lap is left', () => {
    expect(repPaceSecPerKm([{ splits: null }, { splits: [] }])).toBeNull()
    expect(repPaceSecPerKm([{ splits: null }, { splits: [lap('interval_active', 2, 280)] }])).toBe(280)
  })
})
