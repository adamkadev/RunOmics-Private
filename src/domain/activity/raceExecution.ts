import type { Activity, ActivitySplit } from './types'

export interface RaceExecutionLap {
  distanceMeters: number
  durationSeconds: number
  paceSecPerKm: number | null
  avgHr: number | null
}

export interface RaceExecution {
  fullLaps: RaceExecutionLap[]
  partialLap: RaceExecutionLap | null
  trend: {
    firstFullLapPaceSecPerKm: number
    lastFullLapPaceSecPerKm: number
    positiveSplitSecondsPerKm: number
  } | null
}

const MIN_FULL_LAP_METERS = 900

function toLap(split: ActivitySplit): RaceExecutionLap {
  return {
    distanceMeters: split.distanceM,
    durationSeconds: split.durationSec,
    paceSecPerKm: split.distanceM > 0 ? Math.round((split.durationSec / split.distanceM) * 1000) : null,
    avgHr: split.avgHr,
  }
}

export function raceExecution(activity: Pick<Activity, 'type' | 'splits'>): RaceExecution | null {
  if (activity.type !== 'Race') return null

  const laps = (activity.splits ?? []).filter((split) => split.type === 'lap')
  if (laps.length === 0) return null

  const fullLaps = laps.filter((lap) => lap.distanceM >= MIN_FULL_LAP_METERS).map(toLap)
  const partial = laps.filter((lap) => lap.distanceM < MIN_FULL_LAP_METERS).at(-1)
  const firstPace = fullLaps[0]?.paceSecPerKm ?? null
  const lastPace = fullLaps.at(-1)?.paceSecPerKm ?? null

  return {
    fullLaps,
    partialLap: partial ? toLap(partial) : null,
    trend: fullLaps.length >= 2 && firstPace !== null && lastPace !== null
      ? {
          firstFullLapPaceSecPerKm: firstPace,
          lastFullLapPaceSecPerKm: lastPace,
          positiveSplitSecondsPerKm: lastPace - firstPace,
        }
      : null,
  }
}
