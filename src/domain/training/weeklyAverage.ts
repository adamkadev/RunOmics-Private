import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'

/** The weeks the one weekly average is taken over. */
export const WEEKLY_AVERAGE_WEEKS = 12

/**
 * The one "km a week" (v4.6): the mean of the last 12 complete Monday-Sunday
 * weeks, the week under way left out. Analytics' Weekly distance, its Year to
 * date projection and Goals' projection all read this; they used to print 28
 * and 26 km/wk side by side, one over the chart's weeks and one over 8.
 */
export function weeklyAverageKm(activities: ReadonlyArray<{ date: string; distanceKm: number }>, today: string): number {
  const end = startOfWeek(new Date(`${today.slice(0, 10)}T00:00:00`))
  const from = isoDate(addDays(end, -7 * WEEKLY_AVERAGE_WEEKS))
  const to = isoDate(end)
  const km = activities.filter((a) => a.date.slice(0, 10) >= from && a.date.slice(0, 10) < to).reduce((s, a) => s + a.distanceKm, 0)
  return Math.round((km / WEEKLY_AVERAGE_WEEKS) * 10) / 10
}
