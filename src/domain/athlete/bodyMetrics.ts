/** How a graded value reads at a glance. The UI picks the icon and color. */
export type VerdictTone = 'success' | 'neutral' | 'warning' | 'danger'

export type BmiBand = 'underweight' | 'healthy' | 'overweight' | 'obese'

// WHO adult cutoffs. Garmin computes the BMI itself from the synced height and
// weight; we only classify the number it reports.
export function bmiBand(bmi: number): BmiBand {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'healthy'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

export const BMI_BAND_TONE: Record<BmiBand, VerdictTone> = {
  underweight: 'warning',
  healthy: 'success',
  overweight: 'warning',
  obese: 'danger',
}

export type FitnessAgeBand = 'younger' | 'onPar' | 'older'

// A fitness age is only meaningful against the chronological one. Under a year
// either way is noise, so that band reads as "on par" rather than a win/loss.
export function fitnessAgeBand(fitnessAge: number, age: number): FitnessAgeBand {
  const delta = age - fitnessAge
  if (delta >= 1) return 'younger'
  if (delta <= -1) return 'older'
  return 'onPar'
}

export const FITNESS_AGE_BAND_TONE: Record<FitnessAgeBand, VerdictTone> = {
  younger: 'success',
  onPar: 'neutral',
  older: 'warning',
}

/** Whole years between the fitness age and the real one, for the band label. */
export function fitnessAgeDeltaYears(fitnessAge: number, age: number): number {
  return Math.abs(Math.round(age - fitnessAge))
}
