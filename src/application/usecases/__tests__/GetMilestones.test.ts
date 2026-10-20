import { describe, it, expect } from 'vitest'
import {
  findDistanceTierMilestones,
  findLifetimeDistanceMilestones,
  findActivityCountMilestones,
  currentWeekStreak,
  longestWeekStreak,
  findNextMilestones,
} from '../GetMilestones'
import type { Activity } from '@/domain/activity/types'
import { isoWeekNumber } from '@/lib/calendarDate'

describe('findDistanceTierMilestones', () => {
  it('records each tier crossed as cumulative distance grows', () => {
    const acts = [
      { date: '2026-01-01', distanceKm: 300 },
      { date: '2026-02-01', distanceKm: 300 },
      { date: '2026-03-01', distanceKm: 500 },
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
    const now = new Date('2026-07-06T00:00:00')
    const acts = [act('2026-07-06'), act('2026-06-29'), act('2026-06-22')]
    const streak = currentWeekStreak(acts, now)
    expect(streak?.weeks).toBe(3)
  })

  it('stops counting at the first inactive week', () => {
    const now = new Date('2026-07-06T00:00:00')
    const acts = [act('2026-07-06'), act('2026-06-22')]
    const streak = currentWeekStreak(acts, now)
    expect(streak?.weeks).toBe(1)
  })

  it('carries the streak into a new week that has no run yet, instead of resetting to 0', () => {
    const now = new Date('2026-07-13T00:00:00')
    const acts = [act('2026-07-06'), act('2026-06-29'), act('2026-06-22')]
    const streak = currentWeekStreak(acts, now)
    expect(streak?.weeks).toBe(3)
  })

  it('null when neither the current nor the previous week has an activity', () => {
    const now = new Date('2026-07-13T00:00:00')
    const acts = [act('2026-06-22')]
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
      act('2026-01-05'), act('2026-01-12'), act('2026-01-19'), act('2026-01-26'),
      act('2026-03-02'),
      act('2026-06-01'), act('2026-06-08'),
    ]
    expect(longestWeekStreak(acts)).toBe(4)
  })

  it('counts only weeks with enough runs when given a weekly target (3.1)', () => {
    const acts = [
      act('2026-06-01'), act('2026-06-02'), act('2026-06-03'),
      act('2026-06-08'), act('2026-06-09'), act('2026-06-10'),
      act('2026-06-15'),
    ]
    expect(longestWeekStreak(acts, 3)).toBe(2)
    expect(longestWeekStreak(acts)).toBe(3)
    // The week of 15 June is under way and under target: the streak holds from the week before.
    expect(currentWeekStreak(acts, new Date('2026-06-16T00:00:00'), 3)?.weeks).toBe(2)
    expect(currentWeekStreak(acts, new Date('2026-06-23T00:00:00'), 3)).toBeNull()
  })

  it('counts a run spanning a calendar year boundary', () => {
    const acts = [act('2025-12-22'), act('2025-12-29'), act('2026-01-05')]
    expect(longestWeekStreak(acts)).toBe(3)
  })
})

describe('findNextMilestones', () => {
  const runs = (n: number, date: string, km: number) => Array.from({ length: n }, () => ({ date, distanceKm: km }))

  it('names the next run count and this year\'s next distance, with what is left', () => {
    const acts = [...runs(100, '2025-06-01', 10), ...runs(215, '2026-03-01', 7.2932)]
    const [count, distance] = findNextMilestones(acts, 2026, [250, 300, 350, 400], [500, 1000, 1500, 2000])

    expect(count).toMatchObject({ kind: 'activity-count', remaining: 35 })
    expect(count!.progress).toBeCloseTo(0.9)
    // 1,568 km this year: 2,000 is next, 432 to go - last year's 1,000 km does not count.
    expect(distance).toMatchObject({ kind: 'distance-tier', remaining: 432 })
    expect(distance!.progress).toBeCloseTo(1568 / 2000, 3)
  })

  it('drops a milestone past its last tier', () => {
    expect(findNextMilestones(runs(5, '2026-01-01', 100), 2026, [5], [500])).toEqual([])
  })
})
