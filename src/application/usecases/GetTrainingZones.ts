import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAthleteHistory } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'
import { getThresholdSamples } from '@/infrastructure/repositories/JsonThresholdHistoryRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId } from '@/domain/activity/raceResult'
import { estimatedThreshold, type ThresholdEstimate } from '@/domain/training/vdot'
import { isCurrentGarminReading } from '@/domain/sync/garminReadings'
import { appTodayIso } from '@/lib/calendarDate'
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
  /** Set when the watch gives no current threshold pace and it was estimated from a recent best effort instead. */
  estimate?: Omit<ThresholdEstimate, 'thresholdPaceSecPerKm'>
  zones: TrainingZone[]
}

/** Zone edges as multiples of threshold pace, shared like the HR zones' so no pace falls between two zones. */
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
    paceMaxSecPerKm: i === ZONE_DEFS.length - 1 ? edges[i + 1]! : edges[i + 1]! - 1,
  }))
}

function zonesAt(thresholdPaceSecPerKm: number): TrainingZone[] {
  // Easy first, as the table and the coach read them.
  return paceZones(thresholdPaceSecPerKm)
    .reverse()
    .map((zone) => ({ ...zone, ...t.trainingZones.zones[zone.key] }))
}

/** When the pace took its current value: athlete history repeats it whenever another metric, the weight say, moves. */
export function thresholdPaceSince(samples: readonly { date: string; thresholdPaceSecPerKm?: number }[], current: number): string | null {
  let since: string | null = null
  let previous: number | undefined
  for (const { date, thresholdPaceSecPerKm: pace } of [...samples].sort((a, b) => a.date.localeCompare(b.date))) {
    if (pace === undefined) continue
    if (pace !== previous) since = pace === current ? date : null
    previous = pace
  }
  return since
}

function currentGarminThreshold(today: string): number | null {
  const { thresholdPaceSecPerKm } = getAthleteProfile()
  if (!thresholdPaceSecPerKm) return null
  const since = thresholdPaceSince([...getAthleteHistory(), ...getThresholdSamples()], thresholdPaceSecPerKm)
  return since === null || isCurrentGarminReading('thresholdPace', since, today) ? thresholdPaceSecPerKm : null
}

export async function getTrainingZones(today = appTodayIso()): Promise<TrainingZonesData | null> {
  return trainingZonesOn(today)
}

export function trainingZonesOn(today: string): TrainingZonesData | null {
  const thresholdPaceSecPerKm = currentGarminThreshold(today)
  if (thresholdPaceSecPerKm) return { thresholdPaceSecPerKm, zones: zonesAt(thresholdPaceSecPerKm) }

  const estimate = estimatedThreshold(getAllActivities(), officialResultsByActivityId(getOfficialRaceResults()), today)
  if (!estimate) return null
  const { thresholdPaceSecPerKm: pace, ...basis } = estimate
  return { thresholdPaceSecPerKm: pace, estimate: basis, zones: zonesAt(pace) }
}
