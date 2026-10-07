import type { TrainingStatus } from '@/domain/training/status'

export type ReadinessTone = 'go' | 'caution' | 'hold'

/**
 * Form (TSB) on the usual scale (Coggan; TrainingPeaks and intervals.icu read
 * it the same way): above +5 fresh, +5 to -10 neutral, -10 to -30 the
 * productive training zone, below -30 high risk.
 */
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
 * The Today verdict's tone. Green light is the normal state of a block: the
 * load is in range and the plan stands as written. Caution names something
 * to watch: Form deep in the training zone, fatigue climbing fast, a
 * moderate-risk load, or fitness slipping despite the work. Hold is for real
 * risk: overreaching, a high-risk load, Form in the high-risk zone, or deep
 * in the training zone with fatigue still climbing fast.
 *
 * Green light used to need Form above +5 with fatigue falling, which only a
 * taper or a few days off give, so caution was the default: 398 days of 464,
 * a productive build with ACWR at 0.9 included, and it said nothing.
 */
export function verdictTone(status: TrainingStatus): ReadinessTone {
  if (status.status === 'overreaching' || status.risk === 'high') return 'hold'
  const climbing = fatigueRisingFast(status)
  if (status.tsbNow < FORM_HIGH_RISK || (status.tsbNow < FORM_DEEP && climbing)) return 'hold'
  if (status.tsbNow < FORM_DEEP || climbing || status.risk === 'moderate' || status.status === 'unproductive') return 'caution'
  return 'go'
}
