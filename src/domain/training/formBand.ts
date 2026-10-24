/** Very fresh is past ready: rested long enough that fitness starts to slip. */
export type FormBand = 'tired' | 'neutral' | 'fresh' | 'veryFresh'

export const FORM_BAND_THRESHOLDS = { tiredBelow: -10, freshAbove: 5, veryFreshAbove: 25 } as const

export function formBand(tsb: number): FormBand {
  if (tsb < FORM_BAND_THRESHOLDS.tiredBelow) return 'tired'
  if (tsb <= FORM_BAND_THRESHOLDS.freshAbove) return 'neutral'
  if (tsb <= FORM_BAND_THRESHOLDS.veryFreshAbove) return 'fresh'
  return 'veryFresh'
}
