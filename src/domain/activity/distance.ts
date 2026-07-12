import type { Activity } from './types'

type DistanceActivity = Pick<Activity, 'date' | 'distanceKm'>

/**
 * Sum of distance (km) for a set of activities, rounded to a whole km exactly
 * once. Rounding once - rather than rounding intermediate parts and summing -
 * is what keeps Progress, Goals and Analytics from disagreeing by a kilometre.
 */
export function sumDistanceKm(activities: ReadonlyArray<DistanceActivity>): number {
  return Math.round(activities.reduce((s, a) => s + a.distanceKm, 0))
}

/**
 * Whole-km distance total for a calendar year - the single value Progress,
 * Goals and Analytics all read so they can't diverge.
 */
export function yearDistanceKm(activities: ReadonlyArray<DistanceActivity>, year: number): number {
  return sumDistanceKm(activities.filter((a) => a.date.startsWith(String(year))))
}
