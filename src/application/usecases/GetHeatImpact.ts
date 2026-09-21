import { t } from '@/i18n'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { round } from '@/lib/math'

const EASY_TYPES: ActivityType[] = ['Base']
const MIN_DISTANCE_KM = 3
const MIN_RUNS_PER_BAND = 8

export type HeatBandId = 'cold' | 'cool' | 'mild' | 'warm' | 'hot'

const BANDS: { id: HeatBandId; maxC: number }[] = [
  { id: 'cold', maxC: 5 },
  { id: 'cool', maxC: 15 },
  { id: 'mild', maxC: 20 },
  { id: 'warm', maxC: 25 },
  { id: 'hot', maxC: Infinity },
]

export interface HeatBand {
  id: HeatBandId
  label: string
  runCount: number
  avgApparentTempC: number
  paceAtRefHr: number
  costSecPerKm: number
}

export interface HeatImpactData {
  refHeartRate: number
  bands: HeatBand[]
}

export function heatBandOf(apparentTempC: number): HeatBandId {
  return (BANDS.find((b) => apparentTempC < b.maxC) ?? BANDS[BANDS.length - 1]!).id
}

export function heatImpact(activities: Activity[]): HeatImpactData | null {
  const easy = activities.filter(
    (a) =>
      EASY_TYPES.includes(a.type) &&
      a.weather !== null &&
      a.paceSecPerKm !== null &&
      a.avgHeartRate !== null &&
      a.distanceKm >= MIN_DISTANCE_KM,
  )
  if (!easy.length) return null

  const refHeartRate = Math.round(easy.reduce((s, a) => s + a.avgHeartRate!, 0) / easy.length)

  const bands = BANDS.map(({ id }) => {
    const runs = easy.filter((a) => heatBandOf(a.weather!.apparentTempC) === id)
    if (runs.length < MIN_RUNS_PER_BAND) return null

    const ef = runs.reduce((s, a) => s + (1000 / a.paceSecPerKm!) * 60 / a.avgHeartRate!, 0) / runs.length
    return {
      id,
      label: t.analytics.charts.heatImpact.bands[id],
      runCount: runs.length,
      avgApparentTempC: round(runs.reduce((s, a) => s + a.weather!.apparentTempC, 0) / runs.length),
      paceAtRefHr: Math.round(60_000 / (ef * refHeartRate)),
    }
  }).filter((b): b is Omit<HeatBand, 'costSecPerKm'> => b !== null)

  if (bands.length < 2) return null

  const fastest = Math.min(...bands.map((b) => b.paceAtRefHr))
  return {
    refHeartRate,
    bands: bands.map((b) => ({ ...b, costSecPerKm: b.paceAtRefHr - fastest })),
  }
}

export function getHeatImpact(): HeatImpactData | null {
  return heatImpact(getAllActivities())
}
