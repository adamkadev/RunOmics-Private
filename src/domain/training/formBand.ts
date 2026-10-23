/**
 * - tired: fatigue well ahead of fitness;
 * - neutral: the ordinary training range;
 * - fresh: rested and ready for quality or a race;
 * - very fresh: rested long enough that fitness starts to slip (the same
 *   ceiling the taper reads as over-rested).
 */
export type FormBand = 'tired' | 'neutral' | 'fresh' | 'veryFresh'

export const FORM_BAND_THRESHOLDS = { tiredBelow: -10, freshAbove: 5, veryFreshAbove: 25 } as const

export function formBand(tsb: number): FormBand {
  if (tsb < FORM_BAND_THRESHOLDS.tiredBelow) return 'tired'
  if (tsb <= FORM_BAND_THRESHOLDS.freshAbove) return 'neutral'
  if (tsb <= FORM_BAND_THRESHOLDS.veryFreshAbove) return 'fresh'
  return 'veryFresh'
}
