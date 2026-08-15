import fs from 'fs'
import { dataPath } from '../dataPath'

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
  /** Garmin's fitness age, and the floor it says the current training can reach. */
  fitnessAgeYrs?: number
  achievableFitnessAgeYrs?: number
  bmi?: number
  /** Primary training device the Garmin metrics above are measured by. */
  deviceId?: number
  deviceName?: string
  deviceFirmware?: string
  /** ISO date the device was registered on Garmin Connect. */
  deviceSince?: string
  lastUpdate?: string
}

export function getAthleteProfile(): AthleteProfile {
  const filePath = dataPath('athlete.json')
  if (!fs.existsSync(filePath)) return {}

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>
  const profile: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) profile[key] = value
  }
  return profile as AthleteProfile
}
