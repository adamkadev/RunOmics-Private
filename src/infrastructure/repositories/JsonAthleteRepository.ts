import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

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
}

export function getAthleteProfile(): AthleteProfile {
  const raw = readJsonFile<Record<string, unknown>>(dataPath('athlete.json'), {})

  const profile: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) profile[key] = value
  }
  return profile as AthleteProfile
}
