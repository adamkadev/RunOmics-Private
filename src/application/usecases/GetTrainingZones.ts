import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { t } from '@/i18n'

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
// Names and descriptions live in i18n, keyed by `key`, so the zone card follows
// the app locale instead of being pinned to English.
const ZONE_DEFS = [
  { key: 'easy', paceMultMin: 1.17, paceMultMax: 1.46 },
  { key: 'marathon', paceMultMin: 1.03, paceMultMax: 1.15 },
  { key: 'threshold', paceMultMin: 0.98, paceMultMax: 1.02 },
  { key: 'vo2max', paceMultMin: 0.86, paceMultMax: 0.91 },
] as const

export async function getTrainingZones(): Promise<TrainingZonesData | null> {
  const { thresholdPaceSecPerKm } = getAthleteProfile()
  if (!thresholdPaceSecPerKm) return null

  const zones: TrainingZone[] = ZONE_DEFS.map(({ key, paceMultMin, paceMultMax }) => ({
    key,
    ...t.trainingZones.zones[key],
    paceMinSecPerKm: Math.round(thresholdPaceSecPerKm * paceMultMin),
    paceMaxSecPerKm: Math.round(thresholdPaceSecPerKm * paceMultMax),
  }))

  return { thresholdPaceSecPerKm, zones }
}
