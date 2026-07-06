import { describe, it, expect } from 'vitest'
import { findDistanceTierMilestones, currentWeekStreak } from '../GetMilestones'
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
})
