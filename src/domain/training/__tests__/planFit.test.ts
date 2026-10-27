import { describe, expect, it } from 'vitest'
import { planFit, type FitRun, type FitSession } from '../planFit'

const run = (overrides: Partial<FitRun> = {}): FitRun => ({ distanceKm: 10, durationSeconds: 3_000, avgHeartRate: 145, type: 'Base', ...overrides })
const session = (overrides: Partial<FitSession> = {}): FitSession => ({ distanceM: 10_000, durationSeconds: null, type: 'Base', hrCapBpm: null, ...overrides })

describe('as planned', () => {
  it('holds within 15 % of the planned distance either way', () => {
    expect(planFit(run({ distanceKm: 8.6 }), session())).toBe('asPlanned')
    expect(planFit(run({ distanceKm: 11.4 }), session())).toBe('asPlanned')
    expect(planFit(run({ distanceKm: 8.4 }), session())).toBe('shorter')
    expect(planFit(run({ distanceKm: 11.6 }), session())).toBe('longer')
  })

  it('takes the duration when the distance is off or not given', () => {
    expect(planFit(run({ distanceKm: 7, durationSeconds: 3_000 }), session({ durationSeconds: 3_000 }))).toBe('asPlanned')
    expect(planFit(run({ durationSeconds: 1_500 }), session({ distanceM: null, durationSeconds: 3_000 }))).toBe('shorter')
  })

  it('calls a run over the heart-rate cap harder, whatever its length', () => {
    expect(planFit(run({ avgHeartRate: 156 }), session({ hrCapBpm: 150 }))).toBe('harder')
    expect(planFit(run({ avgHeartRate: null }), session({ hrCapBpm: 150 }))).toBe('asPlanned')
  })

  it('reads the session family from the shown type', () => {
    expect(planFit(run({ type: 'Threshold' }), session())).toBe('harder')
    expect(planFit(run(), session({ type: 'Threshold' }))).toBe('easier')
    expect(planFit(run({ type: 'VO2Max' }), session({ type: 'Threshold' }))).toBe('asPlanned')
  })

  it('has nothing to fault in a session given no length', () => {
    expect(planFit(run({ distanceKm: 2 }), session({ distanceM: null }))).toBe('asPlanned')
  })
})
