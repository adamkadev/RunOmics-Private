import { getVO2max } from './GetRecords'

export interface TrainingZone {
  key: string
  label: string
  shortDesc: string
  example: string
  pctMin: number
  pctMax: number
  paceMinSecPerKm: number  // faster end (pctMax)
  paceMaxSecPerKm: number  // slower end (pctMin)
}

export interface TrainingZonesData {
  vo2max: number
  zones: TrainingZone[]
}

// Jack Daniels VO2 demand at velocity v (m/min)
// VO2 = -4.60 + 0.182258v + 0.000104v²
// Inverse: given target VO2 = pct × VO2max, solve quadratic for v
function paceFromPct(pct: number, vo2max: number): number {
  const vo2 = pct * vo2max
  const a = 0.000104
  const b = 0.182258
  const c = -(4.60 + vo2)
  const v = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) // m/min
  return Math.round((1000 / v) * 60) // sec/km
}

const ZONE_DEFS = [
  {
    key: 'easy',
    label: 'Easy',
    shortDesc: 'Aerobic base & recovery',
    example: 'Long runs, warm-up, cool-down',
    pctMin: 0.59,
    pctMax: 0.74,
  },
  {
    key: 'marathon',
    label: 'Marathon',
    shortDesc: 'Aerobic power & race pace',
    example: 'Tempo long runs, M-pace workouts',
    pctMin: 0.75,
    pctMax: 0.84,
  },
  {
    key: 'threshold',
    label: 'Threshold',
    shortDesc: 'Comfortably hard - T pace',
    example: 'Cruise intervals, tempo runs 20–40 min',
    pctMin: 0.85,
    pctMax: 0.88,
  },
  {
    key: 'vo2max',
    label: 'VO2max',
    shortDesc: '5K race effort - I pace',
    example: '3–5 min intervals, track workouts',
    pctMin: 0.95,
    pctMax: 1.00,
  },
] as const

export function getTrainingZones(): TrainingZonesData | null {
  const vo2max = getVO2max()
  if (!vo2max) return null

  const zones: TrainingZone[] = ZONE_DEFS.map(({ key, label, shortDesc, example, pctMin, pctMax }) => ({
    key,
    label,
    shortDesc,
    example,
    pctMin,
    pctMax,
    paceMinSecPerKm: paceFromPct(pctMax, vo2max),
    paceMaxSecPerKm: paceFromPct(pctMin, vo2max),
  }))

  return { vo2max, zones }
}
