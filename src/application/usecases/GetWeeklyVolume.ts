import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { buildWeeklyTrends } from './GetAnalyticsData'

/**
 * One week of running, as the dashboard's volume chart reads it. A subset of
 * WeeklyTrendPoint rather than its own shape: the weeks come from the same
 * builder, so the chart cannot drift from the analytics series it shares a
 * definition with.
 */
export interface WeeklyVolumePoint {
  /** The Monday of the week, which is what the windowed chart card pages on. */
  date: string
  label: string
  distanceKm: number
  sessionCount: number
}

/**
 * Every ISO week the athlete has run, oldest first. Unwindowed on purpose - the
 * chart pages through its own 4w/6m/1y windows and needs the full history
 * behind it to do that.
 */
export function getWeeklyVolume(): WeeklyVolumePoint[] {
  return buildWeeklyTrends(getAllActivities())
}
