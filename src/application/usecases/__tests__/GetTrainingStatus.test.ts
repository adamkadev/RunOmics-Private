import { describe, it, expect } from 'vitest'
import { acwr, loadTrend, classify, riskFromGarmin } from '../GetTrainingStatus'
import type { Activity } from '@/domain/activity/types'

const REF = new Date('2024-06-15T00:00:00')
const DAY_MS = 86_400_000

function daysAgo(n: number): string {
  const d = new Date(REF.getTime() - n * DAY_MS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const act = (date: string, km: number): Activity =>
  ({ date, distanceKm: km }) as Activity

describe('acwr', () => {
  it('returns null when chronic load is too low (< 5 km/week)', () => {
    // Only 10 km in 28 days → chronic = 2.5
    expect(acwr([act(daysAgo(1), 10)], REF)).toBeNull()
  })

  it('returns null with no activities', () => {
    expect(acwr([], REF)).toBeNull()
  })

  it('calculates ratio: high acute week relative to chronic', () => {
    // 28-day km: 40 → chronic = 10  |  7-day km: 20 → acwr = 2.00
    const acts = [
      act(daysAgo(1), 10),
      act(daysAgo(5), 10),
      act(daysAgo(10), 10),
      act(daysAgo(20), 10),
    ]
    expect(acwr(acts, REF)).toBe(2.00)
  })

  it('calculates ratio: balanced load (acwr ≈ 1)', () => {
    // 28-day km: 40 → chronic = 10  |  7-day km: 10 → acwr = 1.00
    const acts = [
      act(daysAgo(3), 10),
      act(daysAgo(9), 10),
      act(daysAgo(15), 10),
      act(daysAgo(25), 10),
    ]
    expect(acwr(acts, REF)).toBe(1.00)
  })

  it('excludes activities outside 28-day window', () => {
    // Only activity at daysAgo(30) - outside 28-day window
    expect(acwr([act(daysAgo(30), 50)], REF)).toBeNull()
  })

  it('7-day boundary: daysAgo(6) is in, daysAgo(7) is out', () => {
    // Only in 7d window: 10km at daysAgo(6)
    // 28-day km: 40 → chronic = 10 | 7-day km: 10 → acwr = 1.00
    const acts = [
      act(daysAgo(6), 10),   // inside 7d
      act(daysAgo(7), 0),    // outside 7d, inside 28d - zero km, no effect
      act(daysAgo(10), 10),
      act(daysAgo(18), 10),
      act(daysAgo(25), 10),
    ]
    expect(acwr(acts, REF)).toBe(1.00)
  })
})

describe('loadTrend', () => {
  it('building when ctlDelta > 1.5', () => {
    expect(loadTrend(2, 0)).toBe('building')
    expect(loadTrend(1.51, -10)).toBe('building')
  })

  it('boundary: ctlDelta === 1.5 is maintaining', () => {
    expect(loadTrend(1.5, 0)).toBe('maintaining')
  })

  it('tapering when ctlDelta < -1.5 and tsb > 0', () => {
    expect(loadTrend(-2, 5)).toBe('tapering')
    expect(loadTrend(-5, 1)).toBe('tapering')
  })

  it('detraining when ctlDelta < -1.5 and tsb <= 0', () => {
    expect(loadTrend(-2, 0)).toBe('detraining')
    expect(loadTrend(-3, -10)).toBe('detraining')
  })

  it('maintaining in the middle range', () => {
    expect(loadTrend(0, 0)).toBe('maintaining')
    expect(loadTrend(1, 20)).toBe('maintaining')
    expect(loadTrend(-1, -5)).toBe('maintaining')
  })
})

describe('classify', () => {
  it('overreaching/high when tsb < -30', () => {
    expect(classify(-35, 0, null)).toEqual({ status: 'overreaching', risk: 'high' })
    expect(classify(-31, 2, null)).toEqual({ status: 'overreaching', risk: 'high' })
  })

  it('overreaching/high when ratio > 1.5 regardless of tsb', () => {
    expect(classify(-5, 0, 1.6)).toEqual({ status: 'overreaching', risk: 'high' })
    expect(classify(5, 0, 1.51)).toEqual({ status: 'overreaching', risk: 'high' })
  })

  it('fresh/low when tsb > 8 and ctlDelta >= -1', () => {
    expect(classify(10, -0.5, null)).toEqual({ status: 'fresh', risk: 'low' })
    expect(classify(9, 0, null)).toEqual({ status: 'fresh', risk: 'low' })
  })

  it('productive/low when building and tsb not too negative', () => {
    expect(classify(-10, 2, null)).toEqual({ status: 'productive', risk: 'low' })
  })

  it('productive/moderate when building but tsb very negative', () => {
    expect(classify(-25, 2, null)).toEqual({ status: 'productive', risk: 'moderate' })
  })

  it('detraining when ctlDelta < -2 and tsb < 3', () => {
    expect(classify(2, -3, null)).toEqual({ status: 'detraining', risk: 'low' })
    expect(classify(-1, -2.1, null)).toEqual({ status: 'detraining', risk: 'low' })
  })

  it('recovery when tsb > 0 and ctlDelta < -1', () => {
    expect(classify(5, -2, null)).toEqual({ status: 'recovery', risk: 'low' })
  })

  it('productive/moderate when ratio > 1.3 (default branch)', () => {
    expect(classify(0, 0, 1.4)).toEqual({ status: 'productive', risk: 'moderate' })
  })

  it('productive/low as default', () => {
    expect(classify(0, 0, null)).toEqual({ status: 'productive', risk: 'low' })
    expect(classify(-5, 0, 1.0)).toEqual({ status: 'productive', risk: 'low' })
  })
})

describe('riskFromGarmin', () => {
  it('high when the watch reports overreaching', () => {
    expect(riskFromGarmin('overreaching', 'HIGH')).toBe('high')
  })

  it('moderate when unproductive, whatever the ratio says', () => {
    expect(riskFromGarmin('unproductive', 'LOW')).toBe('moderate')
    expect(riskFromGarmin('unproductive', 'OPTIMAL')).toBe('moderate')
  })

  it('moderate on a HIGH ratio even under a productive status', () => {
    expect(riskFromGarmin('productive', 'HIGH')).toBe('moderate')
  })

  it('low for a productive or maintaining block in range', () => {
    expect(riskFromGarmin('productive', 'OPTIMAL')).toBe('low')
    expect(riskFromGarmin('maintaining', 'LOW')).toBe('low')
  })

  it('low when the watch gave no ratio verdict', () => {
    expect(riskFromGarmin('recovery', null)).toBe('low')
  })
})
