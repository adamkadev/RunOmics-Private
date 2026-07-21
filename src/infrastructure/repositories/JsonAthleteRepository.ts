import fs from 'fs'
import path from 'path'

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
  /** Primary training device the Garmin metrics above are measured by. */
  deviceId?: number
  deviceName?: string
  deviceFirmware?: string
  /** ISO date the device was registered on Garmin Connect. */
  deviceSince?: string
  lastUpdate?: string
}

export function getAthleteProfile(): AthleteProfile {
  const filePath = path.join(process.cwd(), 'public', 'data', 'athlete.json')
  if (!fs.existsSync(filePath)) return {}

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>
  const profile: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) profile[key] = value
  }
  return profile as AthleteProfile
}
