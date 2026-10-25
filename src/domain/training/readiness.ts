import type { TrainingStatus } from '@/domain/training/status'

export type ReadinessTone = 'go' | 'build' | 'caution' | 'hold'

/**
 * Form (TSB) on the usual scale (Coggan; TrainingPeaks and intervals.icu read
 * it the same way): above +5 fresh, +5 to -10 neutral, -10 to -30 the
 * productive training zone, below -30 high risk.
 */
const FORM_FRESH = 5
const FORM_DEEP = -20
const FORM_HIGH_RISK = -30

/** Relative to fitness, never under 5: one run alone moves 7-day fatigue by 5 to 10 points a day. */
function fatigueRisingFast(status: TrainingStatus): boolean {
  return status.atlDelta > Math.max(5, status.ctl * 0.15)
}

/**
 * Build is the normal state of a block: the load is in range and the plan
 * stands as written. Go is the same with fresh legs. Caution names something to
 * watch; hold is for real risk.
 */
export function verdictTone(status: TrainingStatus): ReadinessTone {
  if (status.status === 'overreaching' || status.risk === 'high') return 'hold'
  const climbing = fatigueRisingFast(status)
  if (status.tsbNow < FORM_HIGH_RISK || (status.tsbNow < FORM_DEEP && climbing)) return 'hold'
  if (status.tsbNow < FORM_DEEP || climbing || status.risk === 'moderate' || status.status === 'unproductive') return 'caution'
  return status.tsbNow > FORM_FRESH ? 'go' : 'build'
}

const TONE_ORDER: ReadinessTone[] = ['go', 'build', 'caution', 'hold']

export function worseTone(a: ReadinessTone, b: ReadinessTone): ReadinessTone {
  return TONE_ORDER.indexOf(a) >= TONE_ORDER.indexOf(b) ? a : b
}
