import type { Activity } from './types'

type DistanceActivity = Pick<Activity, 'date' | 'distanceKm'>

export function sumDistanceKm(activities: ReadonlyArray<DistanceActivity>): number {
  return Math.round(activities.reduce((s, a) => s + a.distanceKm, 0))
}

export function yearDistanceKm(activities: ReadonlyArray<DistanceActivity>, year: number): number {
  return sumDistanceKm(activities.filter((a) => a.date.startsWith(String(year))))
}
