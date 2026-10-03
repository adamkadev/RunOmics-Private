import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/domain/training/status'
import { verdictTone } from '../readiness'

const status = (over: Partial<TrainingStatus>): TrainingStatus => ({
  status: 'productive', risk: 'low', loadTrend: 'building', ctl: 49, atl: 63, tsb: -11, tsbNow: -14, acwr: 0.9,
  ctlDelta: 8, ctlDeltaShown: 3, atlDelta: 2, tsbDelta: 10, ctlPeak: 50, source: 'garmin', acwrStatus: 'OPTIMAL',
  chronicLoad: 623, chronicLoadMin: 498, chronicLoadMax: 934, ...over,
})

describe('verdictTone', () => {
  // Oct 2: Garmin productive, ACWR 0.9 optimal, a rest day then an easy Z2 run.
  // Form -14 and fatigue +2.4 in a week read "Hold back" every day.
  it('reads the productive training zone as caution, not hold', () => {
    expect(verdictTone(status({ tsbNow: -14.3, atlDelta: 2.4 }))).toBe('caution')
    expect(verdictTone(status({ tsbNow: -24.8, atlDelta: 3 }))).toBe('caution')
  })

  // A first week: fitness 0, fatigue 2 after one 2 km run.
  it('does not call a first run fatigue', () => {
    expect(verdictTone(status({ ctl: 0, atl: 2, tsbNow: -2, atlDelta: 2, status: 'maintaining' }))).toBe('caution')
  })

  it('holds back in the high-risk zone, or deep in training with fatigue still climbing fast', () => {
    expect(verdictTone(status({ tsbNow: -31 }))).toBe('hold')
    expect(verdictTone(status({ tsbNow: -22, atlDelta: 9 }))).toBe('hold')
    // Fast is relative to fitness: +9 is a climb at fitness 49, ordinary at 80.
    expect(verdictTone(status({ tsbNow: -22, atlDelta: 9, ctl: 80 }))).toBe('caution')
  })

  it('holds back on overreaching or a high-risk load, whatever Form says', () => {
    expect(verdictTone(status({ status: 'overreaching', tsbNow: 2 }))).toBe('hold')
    expect(verdictTone(status({ risk: 'high', tsbNow: -5 }))).toBe('hold')
  })

  it('gives the green light when fresh and fatigue is letting go, unless fitness is slipping', () => {
    expect(verdictTone(status({ tsbNow: 8, atlDelta: -4 }))).toBe('go')
    expect(verdictTone(status({ tsbNow: 8, atlDelta: -4, status: 'detraining' }))).toBe('caution')
    expect(verdictTone(status({ tsbNow: 8, atlDelta: 1 }))).toBe('caution')
  })
})
