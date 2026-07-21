import { describe, it, expect } from 'vitest'
import {
  recentEffortTimes,
  confidenceBandSeconds,
  vo2maxFormFactor,
  applyFormWeighting,
} from '../GetRacePredictions'
import type { Activity } from '@/domain/activity/types'
import type { VO2maxPoint } from '../GetVO2maxHistory'

const act = (date: string, bestEfforts: Record<string, number> | null): Activity =>
  ({ date, bestEfforts }) as Activity

describe('recentEffortTimes', () => {
  it('returns times for the given key, most recent first', () => {
    const activities = [
      act('2026-01-01', { '5k': 1300 }),
      act('2026-03-01', { '5k': 1200 }),
      act('2026-02-01', { '5k': 1250 }),
    ]
    expect(recentEffortTimes(activities, '5k', 5)).toEqual([1200, 1250, 1300])
  })

  it('ignores activities without that key', () => {
    const activities = [act('2026-01-01', { '10k': 2500 }), act('2026-02-01', null)]
    expect(recentEffortTimes(activities, '5k', 5)).toEqual([])
  })

  it('caps to n results', () => {
    const activities = Array.from({ length: 10 }, (_, i) => act(`2026-01-${String(i + 1).padStart(2, '0')}`, { '5k': 1200 + i }))
    expect(recentEffortTimes(activities, '5k', 3)).toHaveLength(3)
  })
})

describe('confidenceBandSeconds', () => {
  it('zero with fewer than 2 recent times', () => {
    expect(confidenceBandSeconds(1200, [1200])).toBe(0)
    expect(confidenceBandSeconds(1200, [])).toBe(0)
  })

  it('scales with the coefficient of variation of recent times', () => {
    // mean=1200, stdev=0 (identical times) -> 0 band
    expect(confidenceBandSeconds(1200, [1200, 1200, 1200])).toBe(0)
    // some real variance produces a non-zero band
    expect(confidenceBandSeconds(1200, [1150, 1200, 1250])).toBeGreaterThan(0)
  })
})

describe('vo2maxFormFactor', () => {
  const point = (date: string, value: number): VO2maxPoint => ({ date, label: date, value })

  it('1 (neutral) with fewer than 2 points', () => {
    expect(vo2maxFormFactor([], 8)).toBe(1)
    expect(vo2maxFormFactor([point('2026-01-01', 50)], 8)).toBe(1)
  })

  // Ten monthly samples, Jan through Oct.
  const monthly = (value: (i: number) => number) =>
    Array.from({ length: 10 }, (_, i) => point(`2026-${String(i + 1).padStart(2, '0')}-28`, value(i)))

  it('greater than 1 when VO2max has improved', () => {
    expect(vo2maxFormFactor(monthly((i) => 50 + i), 8)).toBeGreaterThan(1)
  })

  it('less than 1 when VO2max has declined', () => {
    expect(vo2maxFormFactor(monthly((i) => 60 - i), 8)).toBeLessThan(1)
  })

  it('compares against the window, not against a fixed number of entries back', () => {
    // Latest is 2026-10-28, so an 8-week window reaches back to ~2026-08-28:
    // the August sample (57), not the first one.
    expect(vo2maxFormFactor(monthly((i) => 50 + i), 8)).toBeCloseTo(59 / 57)
  })

  it('falls back to the oldest sample when the history is shorter than the window', () => {
    const history = [point('2026-10-01', 50), point('2026-10-28', 55)]
    expect(vo2maxFormFactor(history, 8)).toBeCloseTo(55 / 50)
  })
})

describe('applyFormWeighting', () => {
  it('leaves the prediction unchanged at formFactor=1', () => {
    expect(applyFormWeighting(1200, 1)).toBe(1200)
  })

  it('predicts a faster time when form has improved (damped)', () => {
    const adjusted = applyFormWeighting(1200, 1.1, 0.5)
    // 1200 * (1 - 0.5*0.1) = 1140
    expect(adjusted).toBe(1140)
  })

  it('predicts a slower time when form has declined', () => {
    const adjusted = applyFormWeighting(1200, 0.9, 0.5)
    expect(adjusted).toBeGreaterThan(1200)
  })
})
