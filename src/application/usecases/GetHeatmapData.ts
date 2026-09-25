import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'
import { isLongRun } from '@/domain/activity/longRun'

export type HeatmapDay = {
  date: string
  distanceKm: number
  sessionCount: number
  /** At least one run that day lasted 90 minutes or more. */
  longRun: boolean
}

export function getHeatmapData(): HeatmapDay[] {
  const activities = getAllActivities()

  const map = new Map<string, { distanceKm: number; sessionCount: number; longRun: boolean }>()
  for (const a of activities) {
    const date = a.date.slice(0, 10)
    const entry = map.get(date) ?? { distanceKm: 0, sessionCount: 0, longRun: false }
    map.set(date, {
      distanceKm: entry.distanceKm + a.distanceKm,
      sessionCount: entry.sessionCount + 1,
      longRun: entry.longRun || isLongRun(a),
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const from = new Date(today)
  from.setDate(from.getDate() - 364)
  const dayOfWeek = from.getDay()
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  from.setDate(from.getDate() + offsetToMonday)

  const days: HeatmapDay[] = []
  const cursor = new Date(from)
  while (cursor <= today) {
    const date = cursor.toISOString().slice(0, 10)
    const data = map.get(date)
    days.push({
      date,
      distanceKm: round(data?.distanceKm ?? 0),
      sessionCount: data?.sessionCount ?? 0,
      longRun: data?.longRun ?? false,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}
