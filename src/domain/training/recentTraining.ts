import { DAY_MS } from '@/lib/calendarDate'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'

export interface RecentTraining {
  /** Monday to today, the calendar week the dashboard's weekly ring counts, not the last seven days. */
  weekRuns: number
  weekKm: number
  lastRun: { type: ActivityType; daysAgo: number; distanceKm: number } | null
}

function dayNumber(date: string): number {
  return Math.floor(new Date(date.slice(0, 10) + 'T00:00:00Z').getTime() / DAY_MS)
}

/** Day 0, 1 January 1970, was a Thursday: three days after a Monday. */
function mondayOf(day: number): number {
  return day - (((day + 3) % 7) + 7) % 7
}

export function recentTraining(activities: ActivitySummary[], today: string): RecentTraining {
  const day = dayNumber(today)
  const past = activities.filter((a) => dayNumber(a.date) <= day).sort((a, b) => b.date.localeCompare(a.date))
  const monday = mondayOf(day)
  const week = past.filter((a) => dayNumber(a.date) >= monday)
  const last = past[0]

  return {
    weekRuns: week.length,
    weekKm: Math.round(week.reduce((sum, a) => sum + a.distanceKm, 0)),
    lastRun: last
      ? { type: last.type, daysAgo: day - dayNumber(last.date), distanceKm: Math.round(last.distanceKm) }
      : null,
  }
}
