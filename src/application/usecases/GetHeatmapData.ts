import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'
import { isLongRun } from '@/domain/activity/longRun'
import { addDays, appTodayIso, isoDate, startOfWeek } from '@/lib/calendarDate'

export type HeatmapDay = {
  date: string
  distanceKm: number
  sessionCount: number
  longRun: boolean
  /** The day's longest run. */
  activityId: string | null
}

export function getHeatmapData(): HeatmapDay[] {
  const activities = getAllActivities()

  const map = new Map<string, { distanceKm: number; sessionCount: number; longRun: boolean; activityId: string; longestKm: number }>()
  for (const a of activities) {
    const date = a.date.slice(0, 10)
    const entry = map.get(date)
    const longest = !entry || a.distanceKm > entry.longestKm
    map.set(date, {
      distanceKm: (entry?.distanceKm ?? 0) + a.distanceKm,
      sessionCount: (entry?.sessionCount ?? 0) + 1,
      longRun: (entry?.longRun ?? false) || isLongRun(a),
      activityId: longest ? a.id : entry!.activityId,
      longestKm: longest ? a.distanceKm : entry!.longestKm,
    })
  }

  // Local dates throughout: toISOString on a local midnight names the day
  // before east of UTC.
  const today = new Date(`${appTodayIso()}T00:00:00`)
  const from = startOfWeek(addDays(today, -364))

  const days: HeatmapDay[] = []
  for (let cursor = from; cursor <= today; cursor = addDays(cursor, 1)) {
    const date = isoDate(cursor)
    const data = map.get(date)
    days.push({
      date,
      distanceKm: round(data?.distanceKm ?? 0),
      sessionCount: data?.sessionCount ?? 0,
      longRun: data?.longRun ?? false,
      activityId: data?.activityId ?? null,
    })
  }

  return days
}
