import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { toActivitySummary } from '@/domain/activity/summary'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import type { Activity, DashboardData } from '@/domain/activity/types'

const RECENT_ACTIVITY_COUNT = 8

export function computeWeekActivityDays(activities: Activity[], now: Date): boolean[] {
  const dateSet = new Set(activities.map((a) => a.date.slice(0, 10)))
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => dateSet.has(isoDate(addDays(monday, i))))
}

export function getDashboardData(): DashboardData {
  return { recentActivities: getAllActivities().slice(0, RECENT_ACTIVITY_COUNT).map(toActivitySummary) }
}
