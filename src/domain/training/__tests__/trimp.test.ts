import { describe, expect, it } from 'vitest'
import { hrBoundsOf, loadSource, trimp } from '../trimp'

const RUN = { avgHeartRate: 150, durationSeconds: 3600 }

describe('trimp', () => {
  it("uses Banister's male weighting without a sex", () => {
    const hrr = (150 - 45) / (195 - 45)
    expect(trimp(RUN)).toBeCloseTo(60 * hrr * 0.64 * Math.exp(1.92 * hrr), 6)
  })

  it("uses Banister's female weighting for a female athlete", () => {
    const hrr = (150 - 50) / (190 - 50)
    const bounds = hrBoundsOf({ maxHrBpm: 190, restingHrBpm: 50, sex: 'female' })
    expect(trimp(RUN, bounds)).toBeCloseTo(60 * hrr * 0.86 * Math.exp(1.67 * hrr), 6)
  })

  it('weighs a female athlete more from easy to threshold effort', () => {
    for (const avgHeartRate of [120, 140, 160, 175]) {
      const run = { avgHeartRate, durationSeconds: 3600 }
      const ratio = trimp(run, { maxHr: 195, restingHr: 45, sex: 'female' }) / trimp(run, { maxHr: 195, restingHr: 45 })
      expect(ratio).toBeGreaterThan(1.05)
      expect(ratio).toBeLessThan(1.25)
    }
  })

  it('fills missing bounds with the defaults and keeps a male sex off the female curve', () => {
    expect(hrBoundsOf({})).toEqual({ maxHr: 195, restingHr: 45 })
    expect(trimp(RUN, hrBoundsOf({ sex: 'male' }))).toBe(trimp(RUN))
  })
})

describe('trimp of a run whose heart rate is not trusted', () => {
  it('is session RPE × minutes scaled to TRIMP units', () => {
    expect(trimp({ avgHeartRate: null, durationSeconds: 3600, hrUntrusted: 'marked', rpe: 4 })).toBeCloseTo(4 * 60 * 0.42, 6)
  })

  it("takes the middle of the run type's expected RPE without one", () => {
    const run = { avgHeartRate: null, durationSeconds: 1800, hrUntrusted: 'beforeReliable' as const, rpe: null, type: 'Base' as const, distanceKm: 4 }
    expect(trimp(run)).toBeCloseTo(2 * 30 * 0.42, 6)
  })

  it('stays on the scale of the heart-rate load for the same easy hour', () => {
    const fromHr = trimp({ avgHeartRate: 140, durationSeconds: 3600 }, { maxHr: 190, restingHr: 55, sex: 'female' })
    const fromEffort = trimp({ avgHeartRate: null, durationSeconds: 3600, hrUntrusted: 'marked', rpe: 3 })
    expect(fromEffort / fromHr).toBeGreaterThan(0.6)
    expect(fromEffort / fromHr).toBeLessThan(1.5)
  })

  it('names where the load came from', () => {
    expect(loadSource({ avgHeartRate: 150, durationSeconds: 600 })).toBe('heartRate')
    expect(loadSource({ avgHeartRate: null, durationSeconds: 600, hrUntrusted: 'wrist' })).toBe('effort')
    expect(loadSource({ avgHeartRate: null, durationSeconds: 600 })).toBeNull()
  })
})
