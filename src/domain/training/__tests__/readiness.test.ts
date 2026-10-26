import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/domain/training/status'
import { verdictTone } from '../readiness'

const status = (over: Partial<TrainingStatus>): TrainingStatus => ({
  status: 'productive', risk: 'low', loadTrend: 'building', ctl: 49, atl: 63, tsb: -11, tsbNow: -14, acwr: 0.9,
  ctlDelta: 8, ctlDeltaShown: 3, atlDelta: 2, tsbDelta: 10, ctlPeak: 50, source: 'garmin', buildingBack: false, acwrStatus: 'OPTIMAL',
  chronicLoad: 623, chronicLoadMin: 498, chronicLoadMax: 934, ...over,
})

describe('verdictTone', () => {
  // Oct 2-7: Garmin productive, ACWR 0.9 optimal, Form -12 to -18 with fatigue flat.
  it('reads a productive block with the load in range as building', () => {
    expect(verdictTone(status({ tsbNow: -14.3, atlDelta: 2.4 }))).toBe('build')
    expect(verdictTone(status({ tsbNow: -17.6, atlDelta: -0.6, ctl: 53.7 }))).toBe('build')
    expect(verdictTone(status({ tsbNow: 3, atlDelta: 1, status: 'maintaining' }))).toBe('build')
    expect(verdictTone(status({ tsbNow: 5, atlDelta: -3 }))).toBe('build')
  })

  // A first week: fitness 0, fatigue 2 after one 2 km run.
  it('does not call a first run fatigue', () => {
    expect(verdictTone(status({ ctl: 0, atl: 2, tsbNow: -2, atlDelta: 2, status: 'maintaining' }))).toBe('build')
  })

  it('reads caution deep in the training zone, on fatigue climbing fast, or on a moderate-risk load', () => {
    // Oct 4, after a 13 km long run.
    expect(verdictTone(status({ tsbNow: -21.4, atlDelta: -1.5, ctl: 53 }))).toBe('caution')
    // Sep 21, the second week back from a two-week break: +16.5 at fitness 45.
    expect(verdictTone(status({ tsbNow: -14.6, atlDelta: 16.5, ctl: 44.7 }))).toBe('caution')
    expect(verdictTone(status({ tsbNow: -9, risk: 'moderate' }))).toBe('caution')
    expect(verdictTone(status({ tsbNow: -5, status: 'unproductive' }))).toBe('caution')
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

  // Aug 2026: two weeks off, Form +30. Nothing calls for care.
  it('gives the green light when fresh, a break included', () => {
    expect(verdictTone(status({ tsbNow: 8, atlDelta: -4 }))).toBe('go')
    expect(verdictTone(status({ tsbNow: 6, atlDelta: 2 }))).toBe('go')
    expect(verdictTone(status({ tsbNow: 30, atlDelta: -12, status: 'detraining', loadTrend: 'detraining' }))).toBe('go')
  })
})
