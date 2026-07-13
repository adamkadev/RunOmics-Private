import fs from 'fs'
import path from 'path'

export interface AthleteProfile {
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  vmaKmh?: number
  displayName?: string
  hrZoneBoundsBpm?: [number, number, number, number]
  maxHrBpm?: number
  restingHrBpm?: number
  age?: number
  sex?: 'male' | 'female'
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
