/**
 * Where Form (TSB) sits, named. "+2" on its own said nothing about whether it
 * was good or bad. The thresholds live here once, so Today's Body card, the
 * Analytics load chart and anything else that names a band agree:
 * - tired: below -10, fatigue well ahead of fitness;
 * - neutral: -10 to +5, the ordinary training range;
 * - fresh: above +5 up to +25, rested and ready for quality or a race;
 * - very fresh: above +25, rested long enough that fitness starts to slip
 *   (the same ceiling the taper reads as over-rested).
 */
export type FormBand = 'tired' | 'neutral' | 'fresh' | 'veryFresh'

export const FORM_BAND_THRESHOLDS = { tiredBelow: -10, freshAbove: 5, veryFreshAbove: 25 } as const

export function formBand(tsb: number): FormBand {
  if (tsb < FORM_BAND_THRESHOLDS.tiredBelow) return 'tired'
  if (tsb <= FORM_BAND_THRESHOLDS.freshAbove) return 'neutral'
  if (tsb <= FORM_BAND_THRESHOLDS.veryFreshAbove) return 'fresh'
  return 'veryFresh'
}
