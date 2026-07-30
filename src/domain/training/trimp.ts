import type { Activity } from '@/domain/activity/types'

export interface HrBounds {
  maxHr: number
  restingHr: number
}

// Population-average fallback when the athlete profile has no HR bounds set.
export const DEFAULT_HR_BOUNDS: HrBounds = { maxHr: 195, restingHr: 45 }

/** Banister-style TRIMP: duration-weighted, exponentially scaled by heart rate reserve. */
export function trimp(
  activity: Pick<Activity, 'avgHeartRate' | 'durationSeconds'>,
  hrBounds: HrBounds = DEFAULT_HR_BOUNDS,
): number {
  if (!activity.avgHeartRate || !activity.durationSeconds) return 0
  const { maxHr, restingHr } = hrBounds
  const hrr = Math.min(1, Math.max(0, (activity.avgHeartRate - restingHr) / (maxHr - restingHr)))
  return (activity.durationSeconds / 60) * hrr * 0.64 * Math.exp(1.92 * hrr)
}
