import type { Activity } from './types'

/** 50 m a 10 km: under it, Minetti's adjustment moved none of 192 real runs by 3 s/km. */
const HILLY_M_PER_KM = 5

/** The run's grade-adjusted pace, where it climbed enough to differ from its pace; null on the flat or before a reprocess. */
export function hillyGap(activity: Pick<Activity, 'gapSecPerKm' | 'elevationGain' | 'distanceKm'>): number | null {
  const { gapSecPerKm, elevationGain, distanceKm } = activity
  if (gapSecPerKm == null || elevationGain == null || distanceKm <= 0) return null
  return elevationGain / distanceKm >= HILLY_M_PER_KM ? gapSecPerKm : null
}
