export type VerdictTone = 'success' | 'neutral' | 'warning' | 'danger'

export type BmiBand = 'underweight' | 'healthy' | 'overweight' | 'obese'

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

export function fitnessAgeDeltaYears(fitnessAge: number, age: number): number {
  return Math.abs(Math.round(age - fitnessAge))
}
