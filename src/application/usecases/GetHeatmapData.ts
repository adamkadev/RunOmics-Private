import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'

export type HeatmapDay = {
  date: string       // YYYY-MM-DD, empty string = padding
  distanceKm: number
  sessionCount: number
}

export function getHeatmapData(): HeatmapDay[] {
  const activities = getAllActivities()

  const map = new Map<string, { distanceKm: number; sessionCount: number }>()
  for (const a of activities) {
    const date = a.date.slice(0, 10)
    const entry = map.get(date) ?? { distanceKm: 0, sessionCount: 0 }
    map.set(date, {
      distanceKm: entry.distanceKm + a.distanceKm,
      sessionCount: entry.sessionCount + 1,
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const from = new Date(today)
  from.setDate(from.getDate() - 364)
  const dayOfWeek = from.getDay() // 0=Sun … 6=Sat
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
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}
