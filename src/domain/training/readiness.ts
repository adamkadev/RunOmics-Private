import type { TrainingStatus } from '@/domain/training/status'

export type ReadinessTone = 'go' | 'caution' | 'hold'

/**
 * Form (TSB) on the usual scale (Coggan; TrainingPeaks and intervals.icu read
 * it the same way): above +5 fresh, +5 to -10 neutral, -10 to -30 the
 * productive training zone, below -30 high risk.
 */
const FORM_FRESH = 5
const FORM_DEEP = -20
const FORM_HIGH_RISK = -30

/**
 * How far the 7-day fatigue must have climbed to count as rising: 15 % of
 * fitness, never under 5. One run moves fatigue by 5 to 10 points a
 * day, so a fixed "more than 1" fired on every run day - and on a first run,
 * where fatigue goes from 0 to 2.
 */
function fatigueRisingFast(status: TrainingStatus): boolean {
  return status.atlDelta > Math.max(5, status.ctl * 0.15)
}

/**
 * The Today verdict's tone. Hold is for real risk: overreaching, a
 * high-risk load, Form in the high-risk zone, or deep in the training zone
 * with fatigue still climbing fast. Form at -10 to -30 is where training
 * works: it held back a productive week with the load in range, rest day and
 * easy run included. That reads as caution - keep the easy days easy - not
 * as a reason to stop.
 */
export function verdictTone(status: TrainingStatus): ReadinessTone {
  if (status.status === 'overreaching' || status.risk === 'high') return 'hold'
  if (status.tsbNow < FORM_HIGH_RISK || (status.tsbNow < FORM_DEEP && fatigueRisingFast(status))) return 'hold'

  const fatigueFalling = status.atlDelta < -1
  if (status.tsbNow > FORM_FRESH && fatigueFalling) {
    const notBuilding = status.status === 'unproductive' || status.status === 'detraining' || status.status === 'recovery'
    return notBuilding ? 'caution' : 'go'
  }
  return 'caution'
}
