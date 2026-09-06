import { MIN_FULL_LAP_METRES } from './sessionExecution'
import type { Activity } from './types'

export interface RaceLap {
  distanceMeters: number
  durationSeconds: number
  paceSecPerKm: number
  avgHr: number | null
}

export interface RaceExecutionTrend {
  firstFullLapPaceSecPerKm: number
  lastFullLapPaceSecPerKm: number
  positiveSplitSecPerKm: number
  fastestFullLapPaceSecPerKm: number
  slowestFullLapPaceSecPerKm: number
  firstFullLapAvgHr: number | null
  lastFullLapAvgHr: number | null
  hrDriftBpm: number | null
}

export interface RaceExecution {
  fullLaps: RaceLap[]
  partialLap: RaceLap | null
  trend: RaceExecutionTrend
}

const MIN_FULL_LAPS_FOR_TREND = 2

function lap(durationSec: number, distanceM: number, avgHr: number | null): RaceLap {
  return {
    distanceMeters: distanceM,
    durationSeconds: durationSec,
    paceSecPerKm: Math.round((durationSec / distanceM) * 1_000),
    avgHr,
  }
}

export function raceExecution(activity: Pick<Activity, 'type' | 'splits'>): RaceExecution | null {
  if (activity.type !== 'Race') return null

  const laps = (activity.splits ?? []).filter((split) => split.type === 'lap' && split.distanceM > 0)
  if (laps.length === 0) return null

  const fullLaps = laps
    .filter((split) => split.distanceM >= MIN_FULL_LAP_METRES)
    .map((split) => lap(split.durationSec, split.distanceM, split.avgHr))
  if (fullLaps.length < MIN_FULL_LAPS_FOR_TREND) return null

  const trailing = laps[laps.length - 1]!
  const partialLap = trailing.distanceM < MIN_FULL_LAP_METRES ? lap(trailing.durationSec, trailing.distanceM, trailing.avgHr) : null

  const first = fullLaps[0]!
  const last = fullLaps[fullLaps.length - 1]!
  const paces = fullLaps.map((entry) => entry.paceSecPerKm)

  return {
    fullLaps,
    partialLap,
    trend: {
      firstFullLapPaceSecPerKm: first.paceSecPerKm,
      lastFullLapPaceSecPerKm: last.paceSecPerKm,
      positiveSplitSecPerKm: last.paceSecPerKm - first.paceSecPerKm,
      fastestFullLapPaceSecPerKm: Math.min(...paces),
      slowestFullLapPaceSecPerKm: Math.max(...paces),
      firstFullLapAvgHr: first.avgHr,
      lastFullLapAvgHr: last.avgHr,
      hrDriftBpm: first.avgHr !== null && last.avgHr !== null ? last.avgHr - first.avgHr : null,
    },
  }
}
