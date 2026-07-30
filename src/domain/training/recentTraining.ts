import type { ActivitySummary, ActivityType } from '@/domain/activity/types'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 7

export interface RecentTraining {
  runs: number
  km: number
  lastRun: { type: ActivityType; daysAgo: number; distanceKm: number } | null
}

function dayNumber(date: string): number {
  return Math.floor(new Date(date.slice(0, 10) + 'T00:00:00Z').getTime() / DAY_MS)
}

/**
 * The last seven days of training, which is what turns "you are fresh" into
 * "you are fresh because you have not run since Thursday".
 */
export function recentTraining(activities: ActivitySummary[], today: string): RecentTraining {
  const day = dayNumber(today)
  const past = activities.filter((a) => dayNumber(a.date) <= day).sort((a, b) => b.date.localeCompare(a.date))
  const week = past.filter((a) => day - dayNumber(a.date) < WINDOW_DAYS)
  const last = past[0]

  return {
    runs: week.length,
    km: Math.round(week.reduce((sum, a) => sum + a.distanceKm, 0)),
    lastRun: last
      ? { type: last.type, daysAgo: day - dayNumber(last.date), distanceKm: Math.round(last.distanceKm) }
      : null,
  }
}
