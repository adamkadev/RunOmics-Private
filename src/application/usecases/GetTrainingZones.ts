import fs from 'fs'
import path from 'path'

interface AthleteProfile {
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  thresholdPowerWatts?: number
  weightKg?: number
}

function readAthleteProfile(): AthleteProfile {
  const filePath = path.join(process.cwd(), 'public', 'athlete.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AthleteProfile
}

export interface TrainingZone {
  key: string
  label: string
  shortDesc: string
  example: string
  paceMinSecPerKm: number // faster end
  paceMaxSecPerKm: number // slower end
}

export interface TrainingZonesData {
  thresholdPaceSecPerKm: number
  zones: TrainingZone[]
}

// Each zone's pace range as a multiplier of threshold pace (threshold = 1.00).
const ZONE_DEFS = [
  {
    key: 'easy',
    label: 'Easy',
    shortDesc: 'Aerobic base & recovery',
    example: 'Long runs, warm-up, cool-down',
    paceMultMin: 1.17,
    paceMultMax: 1.46,
  },
  {
    key: 'marathon',
    label: 'Marathon',
    shortDesc: 'Aerobic power & race pace',
    example: 'Tempo long runs, M-pace workouts',
    paceMultMin: 1.03,
    paceMultMax: 1.15,
  },
  {
    key: 'threshold',
    label: 'Threshold',
    shortDesc: 'Comfortably hard - T pace',
    example: 'Cruise intervals, tempo runs 20–40 min',
    paceMultMin: 0.98,
    paceMultMax: 1.02,
  },
  {
    key: 'vo2max',
    label: 'VO2max',
    shortDesc: '5K race effort - I pace',
    example: '3–5 min intervals, track workouts',
    paceMultMin: 0.86,
    paceMultMax: 0.91,
  },
] as const

export function getTrainingZones(): TrainingZonesData | null {
  const { thresholdPaceSecPerKm } = readAthleteProfile()
  if (!thresholdPaceSecPerKm) return null

  const zones: TrainingZone[] = ZONE_DEFS.map(({ key, label, shortDesc, example, paceMultMin, paceMultMax }) => ({
    key,
    label,
    shortDesc,
    example,
    paceMinSecPerKm: Math.round(thresholdPaceSecPerKm * paceMultMin),
    paceMaxSecPerKm: Math.round(thresholdPaceSecPerKm * paceMultMax),
  }))

  return { thresholdPaceSecPerKm, zones }
}
