import fs from 'fs'
import path from 'path'

export interface AthleteProfile {
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  thresholdPowerWatts?: number
  vmaKmh?: number
  displayName?: string
  hrZoneBoundsBpm?: [number, number, number, number]
  maxHrBpm?: number
  restingHrBpm?: number
  lastUpdate?: string
}

// Null fields are placeholders for values not yet filled in (manually, or by
// the next Garmin sync) - normalized away so callers see plain `undefined`.
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
