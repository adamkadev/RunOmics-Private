import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'

export const WEEKLY_AVERAGE_WEEKS = 12

/**
 * Complete Monday-Sunday weeks only, the week under way left out. Analytics and
 * Goals all read this one "km a week".
 */
export function weeklyAverageKm(activities: ReadonlyArray<{ date: string; distanceKm: number }>, today: string): number {
  const end = startOfWeek(new Date(`${today.slice(0, 10)}T00:00:00`))
  const from = isoDate(addDays(end, -7 * WEEKLY_AVERAGE_WEEKS))
  const to = isoDate(end)
  const km = activities.filter((a) => a.date.slice(0, 10) >= from && a.date.slice(0, 10) < to).reduce((s, a) => s + a.distanceKm, 0)
  return Math.round((km / WEEKLY_AVERAGE_WEEKS) * 10) / 10
}
