import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { t } from '@/i18n'

export interface TrainingZone {
  key: string
  label: string
  shortDesc: string
  hrZone: number
  paceMinSecPerKm: number
  paceMaxSecPerKm: number
}

export interface TrainingZonesData {
  thresholdPaceSecPerKm: number
  zones: TrainingZone[]
}

const ZONE_DEFS = [
  { key: 'easy', hrZone: 2, paceMultMin: 1.17, paceMultMax: 1.46 },
  { key: 'marathon', hrZone: 3, paceMultMin: 1.03, paceMultMax: 1.15 },
  { key: 'threshold', hrZone: 4, paceMultMin: 0.98, paceMultMax: 1.02 },
  { key: 'vo2max', hrZone: 5, paceMultMin: 0.86, paceMultMax: 0.91 },
] as const

export async function getTrainingZones(): Promise<TrainingZonesData | null> {
  const { thresholdPaceSecPerKm } = getAthleteProfile()
  if (!thresholdPaceSecPerKm) return null

  const zones: TrainingZone[] = ZONE_DEFS.map(({ key, hrZone, paceMultMin, paceMultMax }) => ({
    key,
    ...t.trainingZones.zones[key],
    hrZone,
    paceMinSecPerKm: Math.round(thresholdPaceSecPerKm * paceMultMin),
    paceMaxSecPerKm: Math.round(thresholdPaceSecPerKm * paceMultMax),
  }))

  return { thresholdPaceSecPerKm, zones }
}
