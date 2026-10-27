import type { Activity } from '@/domain/activity/types'
import { expectedRpe } from '@/domain/activity/runVerdict'

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

// Foster's session-RPE (CR-10 × minutes) runs about 2.4 times Banister's TRIMP for the same run.
const SESSION_RPE_TO_TRIMP = 0.42

type LoadInput = Pick<Activity, 'avgHeartRate' | 'durationSeconds'> &
  Partial<Pick<Activity, 'hrUntrusted' | 'rpe' | 'type' | 'distanceKm'>>

export type LoadSource = 'heartRate' | 'effort'

export function loadSource(activity: LoadInput): LoadSource | null {
  if (activity.hrUntrusted) return activity.durationSeconds ? 'effort' : null
  return activity.avgHeartRate && activity.durationSeconds ? 'heartRate' : null
}

/** Session-RPE in TRIMP units: the athlete's RPE, else the middle of the band expected for the run's type. */
export function effortLoad(activity: LoadInput): number {
  if (!activity.durationSeconds) return 0
  const [easiest, hardest] = expectedRpe({
    type: activity.type ?? 'Base',
    distanceKm: activity.distanceKm ?? 0,
    durationSeconds: activity.durationSeconds,
  })
  const rpe = activity.rpe ?? (easiest + hardest) / 2
  return rpe * (activity.durationSeconds / 60) * SESSION_RPE_TO_TRIMP
}

export function trimp(activity: LoadInput, hrBounds: HrBounds = DEFAULT_HR_BOUNDS): number {
  if (activity.hrUntrusted) return effortLoad(activity)
  if (!activity.avgHeartRate || !activity.durationSeconds) return 0
  const { maxHr, restingHr } = hrBounds
  const { a, b } = WEIGHTING[hrBounds.sex === 'female' ? 'female' : 'male']
  const hrr = Math.min(1, Math.max(0, (activity.avgHeartRate - restingHr) / (maxHr - restingHr)))
  return (activity.durationSeconds / 60) * hrr * a * Math.exp(b * hrr)
}
