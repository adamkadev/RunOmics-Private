import type { Activity, ActivitySplit, SplitLap } from './types'

export type SessionExecution =
  | {
      kind: 'intervals'
      reps: number
      fadeSecPerKm: number
      spreadSecPerKm: number
      hrDriftBpm: number | null
    }
  | {
      kind: 'steady'
      spreadSecPerKm: number
      hrDriftBpm: number | null
    }
  | null

export const MIN_FULL_LAP_METRES = 900

const MIN_LAPS_FOR_STEADY = 4

function paceSecPerKm(durationSec: number, distanceM: number): number | null {
  return distanceM > 0 ? (durationSec / distanceM) * 1000 : null
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

function intervalExecution(active: ActivitySplit[]): SessionExecution {
  const paces = active.map((s) => paceSecPerKm(s.durationSec, s.distanceM)).filter((p): p is number => p !== null)
  const first = paces[0]
  const last = paces[paces.length - 1]
  if (paces.length < 2 || first === undefined || last === undefined) return null

  const hrs = active.map((s) => s.avgHr).filter((hr): hr is number => hr !== null)
  const firstHr = hrs[0]
  const lastHr = hrs[hrs.length - 1]

  return {
    kind: 'intervals',
    reps: active.length,
    fadeSecPerKm: Math.round(last - first),
    spreadSecPerKm: Math.round(Math.max(...paces) - Math.min(...paces)),
    hrDriftBpm: hrs.length >= 2 && firstHr !== undefined && lastHr !== undefined ? lastHr - firstHr : null,
  }
}

function steadyExecution(laps: SplitLap[]): SessionExecution {
  const full = laps.filter((lap) => lap.distanceM >= MIN_FULL_LAP_METRES)
  if (full.length < MIN_LAPS_FOR_STEADY) return null

  const paces = full.map((lap) => paceSecPerKm(lap.durationSec, lap.distanceM)).filter((p): p is number => p !== null)
  if (paces.length < MIN_LAPS_FOR_STEADY) return null

  const half = Math.floor(full.length / 2)
  const firstHalfHr = average(full.slice(0, half).map((l) => l.avgHr).filter((hr): hr is number => hr !== null))
  const secondHalfHr = average(full.slice(half).map((l) => l.avgHr).filter((hr): hr is number => hr !== null))

  return {
    kind: 'steady',
    spreadSecPerKm: Math.round(Math.max(...paces) - Math.min(...paces)),
    hrDriftBpm: firstHalfHr !== null && secondHalfHr !== null ? Math.round(secondHalfHr - firstHalfHr) : null,
  }
}

export function sessionExecution(activity: Pick<Activity, 'splits'>): SessionExecution {
  const splits = activity.splits ?? []
  const active = splits.filter((s) => s.type === 'interval_active')

  if (active.length >= 2) return intervalExecution(active)

  const only = active[0]
  return only ? steadyExecution(only.laps) : null
}
