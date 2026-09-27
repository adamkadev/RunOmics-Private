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

/**
 * Pace zones from threshold pace with shared edges (v5.5 #11), the way the HR
 * zones work: each zone starts one second after the faster one ends. They
 * were four separate multiplier pairs, which left gaps at 3:59→4:18,
 * 4:28→4:31 and 5:02→5:08. Threshold stays tight around threshold pace
 * (0.97-1.03); the gap below it goes to VO₂max.
 */
const EDGES = [0.86, 0.97, 1.03, 1.16, 1.46] as const
const ZONE_DEFS = [
  { key: 'vo2max', hrZone: 5 },
  { key: 'threshold', hrZone: 4 },
  { key: 'marathon', hrZone: 3 },
  { key: 'easy', hrZone: 2 },
] as const

type ZoneKey = (typeof ZONE_DEFS)[number]['key']

export function paceZones(thresholdPaceSecPerKm: number): (Pick<TrainingZone, 'hrZone' | 'paceMinSecPerKm' | 'paceMaxSecPerKm'> & { key: ZoneKey })[] {
  const edges = EDGES.map((m) => Math.round(thresholdPaceSecPerKm * m))
  return ZONE_DEFS.map(({ key, hrZone }, i) => ({
    key,
    hrZone,
    paceMinSecPerKm: edges[i]!,
    // The slowest zone keeps its own end; every other one stops a second
    // short of the next.
    paceMaxSecPerKm: i === ZONE_DEFS.length - 1 ? edges[i + 1]! : edges[i + 1]! - 1,
  }))
}

export async function getTrainingZones(): Promise<TrainingZonesData | null> {
  const { thresholdPaceSecPerKm } = getAthleteProfile()
  if (!thresholdPaceSecPerKm) return null

  // Easy first, as the table and the coach read them.
  const zones: TrainingZone[] = paceZones(thresholdPaceSecPerKm)
    .reverse()
    .map((zone) => ({ ...zone, ...t.trainingZones.zones[zone.key] }))

  return { thresholdPaceSecPerKm, zones }
}
