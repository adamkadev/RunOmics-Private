import { describe, it, expect } from 'vitest'
import { summarizeWeek, weeklyTrimpTotals, classifyWeekLoadLevel, compareWeekLoad, computeWeekAdherence, summarizePlannedWeek } from '../weekSummary'
import type { Activity } from '@/domain/activity/types'

const HR_BOUNDS = { maxHr: 190, restingHr: 50 }

const act = (over: Partial<Activity>): Activity =>
  ({ type: 'Base', durationSeconds: 1800, distanceKm: 5, avgHeartRate: 150, elevationGain: 0, hrZones: [], ...over }) as Activity

describe('summarizeWeek', () => {
  it('sums trimp and elevation, counts non-easy sessions, and splits easy/hard', () => {
    const zone = (z: number, seconds: number) => ({ zone: z, seconds, percent: 0, minBpm: 0, maxBpm: null })
    const activities = [
      act({ type: 'Base', elevationGain: 50, hrZones: [zone(1, 1000)] }),
      act({ type: 'Threshold', elevationGain: 30, hrZones: [zone(4, 500)] }),
    ]
    const summary = summarizeWeek(activities, HR_BOUNDS)
    expect(summary.elevationGainM).toBe(80)
    expect(summary.keySessionsCount).toBe(1)
    expect(summary.totalTrimp).toBeGreaterThan(0)
    expect(summary.easyPct).toBeCloseTo((1000 / 1500) * 100, 1)
  })

  it('treats a missing elevationGain as 0', () => {
    const summary = summarizeWeek([act({ elevationGain: null })])
    expect(summary.elevationGainM).toBe(0)
  })

  it('returns zeroed stats for an empty week', () => {
    const summary = summarizeWeek([])
    expect(summary).toEqual({ totalTrimp: 0, elevationGainM: 0, keySessionsCount: 0, easyPct: null, hardPct: null })
  })
})

describe('weeklyTrimpTotals', () => {
  it('sums trimp per week number, defaulting missing weeks to 0', () => {
    const byWeek = new Map([[202601, [act({ durationSeconds: 3600, avgHeartRate: 160 })]]])
    const totals = weeklyTrimpTotals([202600, 202601], byWeek, HR_BOUNDS)
    expect(totals[0]).toBe(0)
    expect(totals[1]).toBeGreaterThan(0)
  })
})

describe('classifyWeekLoadLevel', () => {
  it('low below 70, high above 130, normal in between', () => {
    expect(classifyWeekLoadLevel(69)).toBe('low')
    expect(classifyWeekLoadLevel(100)).toBe('normal')
    expect(classifyWeekLoadLevel(131)).toBe('high')
  })
})

describe('compareWeekLoad', () => {
  it('null with fewer than 3 baseline weeks', () => {
    expect(compareWeekLoad(100, [50, 60])).toBeNull()
  })

  it('null when the baseline average is zero', () => {
    expect(compareWeekLoad(100, [0, 0, 0])).toBeNull()
  })

  it('computes percent vs the baseline average', () => {
    expect(compareWeekLoad(120, [80, 100, 120])).toEqual({ percent: 120, level: 'normal' })
  })
})

describe('computeWeekAdherence', () => {
  const day = (date: string, planned: boolean, completed: boolean) => ({ date, planned, completed })

  it('returns null when nothing was planned', () => {
    const days = [day('2026-07-06', false, false), day('2026-07-07', false, true)]
    expect(computeWeekAdherence(days)).toBeNull()
  })

  it('counts every session planned in the week, including the ones still to come', () => {
    const days = [
      day('2026-07-06', true, true),
      day('2026-07-08', true, false), // later in the week
    ]
    expect(computeWeekAdherence(days)).toEqual({ planned: 2, done: 1, percent: 50 })
  })

  it('ignores completed days that were never planned', () => {
    const days = [
      day('2026-07-06', true, true),
      day('2026-07-07', false, true),
    ]
    expect(computeWeekAdherence(days)).toEqual({ planned: 1, done: 1, percent: 100 })
  })
})

describe('summarizePlannedWeek', () => {
  it('counts every planned session, and the non-easy ones as key', () => {
    expect(summarizePlannedWeek(['Base', 'VO2Max', 'Threshold', 'Base'])).toEqual({ total: 4, key: 2 })
  })

  it('counts an untyped planned session in the total but never as key', () => {
    expect(summarizePlannedWeek(['Base', null, undefined])).toEqual({ total: 3, key: 0 })
  })
})
