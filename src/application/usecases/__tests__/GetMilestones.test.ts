import { describe, it, expect } from 'vitest'
import {
  findDistanceTierMilestones,
  findLifetimeDistanceMilestones,
  findActivityCountMilestones,
  currentWeekStreak,
  longestWeekStreak,
} from '../GetMilestones'
import type { Activity } from '@/domain/activity/types'
import { isoWeekNumber } from '@/lib/calendarDate'

describe('findDistanceTierMilestones', () => {
  it('records each tier crossed as cumulative distance grows', () => {
    const acts = [
      { date: '2026-01-01', distanceKm: 300 },
      { date: '2026-02-01', distanceKm: 300 }, // crosses 500
      { date: '2026-03-01', distanceKm: 500 }, // crosses 1000
    ]
    const crossings = findDistanceTierMilestones(acts, [500, 1000, 1500])
    expect(crossings).toEqual([
      { year: 2026, tierKm: 500, date: '2026-02-01' },
      { year: 2026, tierKm: 1000, date: '2026-03-01' },
    ])
  })

  it('can cross multiple tiers on the same activity', () => {
    const acts = [{ date: '2026-01-01', distanceKm: 1200 }]
    const crossings = findDistanceTierMilestones(acts, [500, 1000])
    expect(crossings).toHaveLength(2)
    expect(crossings.every((c) => c.date === '2026-01-01')).toBe(true)
  })

  it('resets cumulative distance at each calendar year boundary', () => {
    const acts = [
      { date: '2025-12-31', distanceKm: 800 },
      { date: '2026-01-01', distanceKm: 800 },
    ]
    const crossings = findDistanceTierMilestones(acts, [500, 1000])
    expect(crossings).toEqual([
      { year: 2025, tierKm: 500, date: '2025-12-31' },
      { year: 2026, tierKm: 500, date: '2026-01-01' },
    ])
  })

  it('empty with no activities', () => {
    expect(findDistanceTierMilestones([])).toEqual([])
  })
})

describe('findLifetimeDistanceMilestones', () => {
  it('does not reset at year boundaries, unlike the per-year tiers', () => {
    const acts = [
      { date: '2025-12-31', distanceKm: 800 },
      { date: '2026-01-01', distanceKm: 800 },
    ]
    const crossings = findLifetimeDistanceMilestones(acts, [500, 1000, 1500])
    expect(crossings).toEqual([
      { tierKm: 500, date: '2025-12-31', cumulativeKm: 800 },
      { tierKm: 1000, date: '2026-01-01', cumulativeKm: 1600 },
      { tierKm: 1500, date: '2026-01-01', cumulativeKm: 1600 },
    ])
  })

  it('empty with no activities', () => {
    expect(findLifetimeDistanceMilestones([])).toEqual([])
  })
})

describe('findActivityCountMilestones', () => {
  it('fires on the exact Nth activity, tracking cumulative distance', () => {
    const acts = [
      { date: '2026-01-01', distanceKm: 10 },
      { date: '2026-01-02', distanceKm: 10 },
      { date: '2026-01-03', distanceKm: 10 },
    ]
    const crossings = findActivityCountMilestones(acts, [2, 3])
    expect(crossings).toEqual([
      { count: 2, date: '2026-01-02', cumulativeKm: 20 },
      { count: 3, date: '2026-01-03', cumulativeKm: 30 },
    ])
  })

  it('empty when activity count never reaches the first tier', () => {
    const acts = [{ date: '2026-01-01', distanceKm: 10 }]
    expect(findActivityCountMilestones(acts, [5, 10])).toEqual([])
  })
})

describe('currentWeekStreak', () => {
  const act = (date: string): Activity => ({ date, week: isoWeekNumber(new Date(date + 'T00:00:00')) }) as Activity

  it('null when the current week has no activity', () => {
    const now = new Date('2026-07-06T00:00:00')
    expect(currentWeekStreak([act('2026-06-01')], now)).toBeNull()
  })

  it('counts consecutive active weeks back from now', () => {
    const now = new Date('2026-07-06T00:00:00') // Monday
    const acts = [act('2026-07-06'), act('2026-06-29'), act('2026-06-22')] // 3 consecutive weeks
    const streak = currentWeekStreak(acts, now)
    expect(streak?.weeks).toBe(3)
  })

  it('stops counting at the first inactive week', () => {
    const now = new Date('2026-07-06T00:00:00')
    const acts = [act('2026-07-06'), act('2026-06-22')] // gap on 06-29
    const streak = currentWeekStreak(acts, now)
    expect(streak?.weeks).toBe(1)
  })

  it('carries the streak into a new week that has no run yet, instead of resetting to 0', () => {
    const now = new Date('2026-07-13T00:00:00') // Monday, brand-new week, nothing logged today
    const acts = [act('2026-07-06'), act('2026-06-29'), act('2026-06-22')] // 3 consecutive prior weeks
    const streak = currentWeekStreak(acts, now)
    expect(streak?.weeks).toBe(3)
  })

  it('null when neither the current nor the previous week has an activity', () => {
    const now = new Date('2026-07-13T00:00:00')
    const acts = [act('2026-06-22')] // last week (07-06) is also empty - streak actually broken
    expect(currentWeekStreak(acts, now)).toBeNull()
  })
})

describe('longestWeekStreak', () => {
  const act = (date: string): Activity => ({ date, week: isoWeekNumber(new Date(date + 'T00:00:00')) }) as Activity

  it('0 with no activities', () => {
    expect(longestWeekStreak([])).toBe(0)
  })

  it('finds the longest run of consecutive active weeks, not just the current one', () => {
    const acts = [
      act('2026-01-05'), act('2026-01-12'), act('2026-01-19'), act('2026-01-26'), // 4-week run
      act('2026-03-02'), // isolated week
      act('2026-06-01'), act('2026-06-08'), // 2-week run
    ]
    expect(longestWeekStreak(acts)).toBe(4)
  })

  it('counts a run spanning a calendar year boundary', () => {
    const acts = [act('2025-12-22'), act('2025-12-29'), act('2026-01-05')]
    expect(longestWeekStreak(acts)).toBe(3)
  })
})
