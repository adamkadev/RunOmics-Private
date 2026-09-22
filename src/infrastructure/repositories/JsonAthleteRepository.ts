import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface RunningInjury {
  /** Free text, e.g. 'left achilles' - the site is what recurs, not a code. */
  site: string
  year: number
  weeksOut?: number
  recurrent?: boolean
  resolved?: boolean
}

/**
 * Prior injury is the most consistently replicated predictor of running
 * injury, so an empty list is only worth anything alongside the date someone
 * last checked: it distinguishes "none" from "never asked".
 */
export interface InjuryHistory {
  reviewedOn: string
  injuries: RunningInjury[]
}

export interface AthleteProfile {
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  vmaKmh?: number
  vo2maxMlKgMin?: number
  weightKg?: number
  heightCm?: number
  displayName?: string
  hrZoneBoundsBpm?: [number, number, number, number, number]
  maxHrBpm?: number
  restingHrBpm?: number
  age?: number
  sex?: 'male' | 'female'
  fitnessAgeYrs?: number
  achievableFitnessAgeYrs?: number
  bmi?: number
  fitnessAgeLastUpdated?: string
  bmiMeasurementDate?: string
  deviceId?: number
  deviceName?: string
  deviceFirmware?: string
  deviceSince?: string
  lastUpdate?: string
  injuryHistory?: InjuryHistory
}

export function getAthleteProfile(): AthleteProfile {
  const raw = readJsonFile<Record<string, unknown>>(dataPath('athlete.json'), {})

  const profile: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) profile[key] = value
  }
  return profile as AthleteProfile
}
