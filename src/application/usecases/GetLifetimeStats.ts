import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'

const DAY_MS = 86_400_000
const YEAR_DAYS = 365.25

export interface LifetimeStats {
  yearsTracked: number
  totalDistanceKm: number
  totalActivities: number
}

export function getLifetimeStats(): LifetimeStats | null {
  const activities = getAllActivities()
  const firstActivity = activities[0]
  if (!firstActivity) return null

  const firstActivityDate = activities.reduce((min, a) => (a.date < min ? a.date : min), firstActivity.date)
  const latestDate = activities.reduce((max, a) => (a.date > max ? a.date : max), firstActivity.date)
  const yearsTracked = round(
    (new Date(latestDate + 'T00:00:00').getTime() - new Date(firstActivityDate + 'T00:00:00').getTime()) /
      (YEAR_DAYS * DAY_MS),
    1,
  )

  return {
    yearsTracked,
    totalDistanceKm: round(activities.reduce((s, a) => s + a.distanceKm, 0), 1),
    totalActivities: activities.length,
  }
}
