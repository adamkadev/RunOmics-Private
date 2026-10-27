import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface RunningInjury {
  /** Free text, e.g. 'left achilles' - the site is what recurs, not a code. */
  site: string
  year: number
  weeksOut?: number
  recurrent?: boolean
  resolved?: boolean
  /** The day it was first noted, YYYY-MM-DD. */
  date?: string
  note?: string
}

/** `reviewedOn` tells "no injuries" from "never asked", and prior injury is the best-replicated predictor of the next. */
export interface InjuryHistory {
  reviewedOn: string
  injuries: RunningInjury[]
}

export type TrainingBreakReason = 'injury' | 'illness' | 'pregnancy' | 'heat' | 'travel' | 'personal'

/** Typed into athlete.json: without it a coach reads a gap as lost fitness rather than a life event. */
export interface TrainingBreak {
  start: string
  end: string
  reason: TrainingBreakReason
  note?: string
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
  trainingBreaks?: TrainingBreak[]
  /** Typed by hand: the weekly kilometres a block's growth stops at. */
  maxWeeklyKm?: number
  /** YYYY-MM-DD: the first day a reliable heart-rate sensor was worn; earlier runs' heart rate is not trusted. */
  hrReliableFrom?: string
}

export function getAthleteProfile(): AthleteProfile {
  const raw = readJsonFile<Record<string, unknown>>(dataPath('athlete.json'), {})

  const profile: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) profile[key] = value
  }
  return profile as AthleteProfile
}
