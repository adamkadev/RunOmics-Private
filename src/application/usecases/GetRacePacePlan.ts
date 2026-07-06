import { getNextRace } from './GetNextRace'
import { getRecords, type RecordEntry } from './GetRecords'
import { getTrainingZones } from './GetTrainingZones'

const DISTANCE_KM: Record<string, number> = {
  '1K': 1,
  '5K': 5,
  '10K': 10,
  'Half-Marathon': 21.0975,
  Marathon: 42.195,
}

const RECORD_KEY: Record<string, string> = {
  '1K': '1k',
  '5K': '5k',
  '10K': '10k',
  'Half-Marathon': 'half',
  Marathon: 'marathon',
}

const KM_BY_RECORD_KEY: Record<string, number> = {
  '1k': 1,
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
}

// Within the roadmap's suggested 1-3% negative-split range.
const NEGATIVE_SPLIT_DRIFT = 0.02

export interface PaceSplit {
  km: number
  splitSeconds: number
  cumulativeSeconds: number
  paceSecPerKm: number
}

export interface RacePacePlan {
  raceName?: string
  distanceKm: number
  targetSeconds: number
  /** True when there was no explicit race target time, so it was Riegel-predicted from a best effort. */
  isEstimated: boolean
  even: PaceSplit[]
  negative: PaceSplit[]
  zoneLabel?: string
  zonePaceRange?: [number, number]
}

export function riegel(sourceSeconds: number, sourceKm: number, targetKm: number): number {
  return Math.round(sourceSeconds * Math.pow(targetKm / sourceKm, 1.06))
}

/** Picks the recorded distance closest (in log-ratio) to the target - mirrors RacePredictions' own heuristic. */
export function bestSource(
  targetKey: string,
  targetKm: number,
  records: RecordEntry[],
): { seconds: number; sourceKm: number } | null {
  let best: { seconds: number; sourceKm: number; ratio: number } | null = null
  for (const r of records) {
    const sourceKm = KM_BY_RECORD_KEY[r.key]
    if (r.seconds === null || r.key === targetKey || sourceKm === undefined) continue
    const ratio = Math.abs(Math.log(targetKm / sourceKm))
    if (best === null || ratio < best.ratio) best = { seconds: r.seconds, sourceKm, ratio }
  }
  return best ? { seconds: best.seconds, sourceKm: best.sourceKm } : null
}

/** 1km segments plus a final fractional one for non-integer distances (e.g. 21.0975km). */
export function buildSegments(distanceKm: number): number[] {
  const full = Math.floor(distanceKm)
  const remainder = distanceKm - full
  const segments = Array<number>(full).fill(1)
  if (remainder > 0.001) segments.push(remainder)
  return segments
}

/**
 * `drift` = 0 for an even split; > 0 ramps pace linearly from slower-than-target
 * at km 1 to faster-than-target at the finish (a negative split), while keeping
 * the total exactly on `targetSeconds`.
 */
export function buildSplits(distanceKm: number, targetSeconds: number, drift: number): PaceSplit[] {
  const segments = buildSegments(distanceKm)
  const n = segments.length
  const avgPaceSecPerKm = targetSeconds / distanceKm

  const rawFactors = n <= 1 || drift === 0
    ? segments.map(() => 1)
    : segments.map((_, i) => 1 + drift / 2 - (drift * i) / (n - 1))

  const weightedTotal = rawFactors.reduce((s, f, i) => s + f * (segments[i] ?? 0), 0)
  const scale = weightedTotal > 0 ? distanceKm / weightedTotal : 1

  let rawCumulative = 0
  const raw = segments.map((segKm, i) => {
    rawCumulative += avgPaceSecPerKm * (rawFactors[i] ?? 1) * scale * segKm
    return rawCumulative
  })

  let roundedCumulative = 0
  return segments.map((segKm, i) => {
    const isLast = i === segments.length - 1
    const cumulativeSeconds = isLast ? Math.round(targetSeconds) : Math.round(raw[i] ?? 0)
    const splitSeconds = cumulativeSeconds - roundedCumulative
    roundedCumulative = cumulativeSeconds
    return { km: i + 1, splitSeconds, cumulativeSeconds, paceSecPerKm: Math.round(splitSeconds / segKm) }
  })
}

export async function getRacePacePlan(): Promise<RacePacePlan | null> {
  const nextRace = await getNextRace()
  if (!nextRace) return null

  const distanceKm = DISTANCE_KM[nextRace.distance]
  if (!distanceKm) return null

  let targetSeconds = nextRace.targetSeconds ?? null
  let isEstimated = false

  if (!targetSeconds) {
    const records = await getRecords()
    const targetKey = RECORD_KEY[nextRace.distance]
    const source = targetKey ? bestSource(targetKey, distanceKm, records) : null
    if (source) {
      targetSeconds = riegel(source.seconds, source.sourceKm, distanceKm)
      isEstimated = true
    }
  }
  if (!targetSeconds) return null

  const zones = await getTrainingZones()
  const avgPaceSecPerKm = targetSeconds / distanceKm
  const zone = zones?.zones.find((z) => avgPaceSecPerKm >= z.paceMinSecPerKm && avgPaceSecPerKm <= z.paceMaxSecPerKm)

  return {
    raceName: nextRace.name,
    distanceKm,
    targetSeconds,
    isEstimated,
    even: buildSplits(distanceKm, targetSeconds, 0),
    negative: buildSplits(distanceKm, targetSeconds, NEGATIVE_SPLIT_DRIFT),
    zoneLabel: zone?.label,
    zonePaceRange: zone ? [zone.paceMinSecPerKm, zone.paceMaxSecPerKm] : undefined,
  }
}
