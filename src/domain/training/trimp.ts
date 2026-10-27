import type { Activity } from '@/domain/activity/types'

export interface HrBounds {
  maxHr: number
  restingHr: number
  sex?: 'male' | 'female'
}

export const DEFAULT_HR_BOUNDS: HrBounds = { maxHr: 195, restingHr: 45 }

/** Banister's weighting: women's blood lactate rises less steeply with heart-rate reserve than men's. */
const WEIGHTING = {
  male: { a: 0.64, b: 1.92 },
  female: { a: 0.86, b: 1.67 },
} as const

export function hrBoundsOf(athlete: { maxHrBpm?: number; restingHrBpm?: number; sex?: 'male' | 'female' }): HrBounds {
  return {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
    ...(athlete.sex ? { sex: athlete.sex } : {}),
  }
}

export function trimp(
  activity: Pick<Activity, 'avgHeartRate' | 'durationSeconds'>,
  hrBounds: HrBounds = DEFAULT_HR_BOUNDS,
): number {
  if (!activity.avgHeartRate || !activity.durationSeconds) return 0
  const { maxHr, restingHr } = hrBounds
  const { a, b } = WEIGHTING[hrBounds.sex === 'female' ? 'female' : 'male']
  const hrr = Math.min(1, Math.max(0, (activity.avgHeartRate - restingHr) / (maxHr - restingHr)))
  return (activity.durationSeconds / 60) * hrr * a * Math.exp(b * hrr)
}
