import type { Activity, ActivitySplit, SplitLap } from './types'

/** Strides after the easy running: how many, and how fast they went. */
export interface Strides {
  count: number
  fastestSecPerKm: number
  slowestSecPerKm: number
}

export type SessionExecution =
  | {
      kind: 'intervals'
      reps: number
      /** Each rep's pace in order, rounded - what a target band is checked against. */
      repPaces: number[]
      fadeSecPerKm: number
      spreadSecPerKm: number
      hrDriftBpm: number | null
      strides?: Strides
    }
  | {
      kind: 'steady'
      spreadSecPerKm: number
      /** Second half's pace against the first's, positive when it slowed. */
      fadeSecPerKm: number
      hrDriftBpm: number | null
      strides?: Strides
    }
  | null

export const MIN_FULL_LAP_METRES = 900

/**
 * A rep under a minute beside a continuous block of running is a stride, not
 * a quality rep: the 20 s strides after an easy run read as "7 reps, 135 s/km
 * faster from first to last" with the easy block as rep 1. With no continuous
 * block, short reps are the session itself - a sprint session.
 */
export const MIN_REP_SECONDS = 60

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
    repPaces: paces.map(Math.round),
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
  const halfPace = (laps: SplitLap[]) =>
    paceSecPerKm(laps.reduce((sum, l) => sum + l.durationSec, 0), laps.reduce((sum, l) => sum + l.distanceM, 0))
  const firstHalfPace = halfPace(full.slice(0, half))
  const secondHalfPace = halfPace(full.slice(half))
  const firstHalfHr = average(full.slice(0, half).map((l) => l.avgHr).filter((hr): hr is number => hr !== null))
  const secondHalfHr = average(full.slice(half).map((l) => l.avgHr).filter((hr): hr is number => hr !== null))

  return {
    kind: 'steady',
    spreadSecPerKm: Math.round(Math.max(...paces) - Math.min(...paces)),
    fadeSecPerKm: firstHalfPace !== null && secondHalfPace !== null ? Math.round(secondHalfPace - firstHalfPace) : 0,
    hrDriftBpm: firstHalfHr !== null && secondHalfHr !== null ? Math.round(secondHalfHr - firstHalfHr) : null,
  }
}

function stridesOf(short: ActivitySplit[]): Strides | null {
  const paces = short.map((s) => paceSecPerKm(s.durationSec, s.distanceM)).filter((p): p is number => p !== null)
  if (!paces.length) return null
  return { count: paces.length, fastestSecPerKm: Math.round(Math.min(...paces)), slowestSecPerKm: Math.round(Math.max(...paces)) }
}

export function sessionExecution(activity: Pick<Activity, 'splits'>): SessionExecution {
  const splits = activity.splits ?? []
  const active = splits.filter((s) => s.type === 'interval_active')
  const continuous = active.filter((s) => s.durationSec >= MIN_REP_SECONDS)

  if (!continuous.length) return active.length >= 2 ? intervalExecution(active) : null

  const main = continuous.length >= 2 ? intervalExecution(continuous) : steadyExecution(continuous[0]!.laps)
  const strides = stridesOf(active.filter((s) => s.durationSec < MIN_REP_SECONDS))
  return main && strides ? { ...main, strides } : main
}

/**
 * The reps of a structured session as one reading - mean pace and heart rate
 * across them - so a threshold session is compared with earlier ones rep for
 * rep, not by a whole-run average that the warm-up and recoveries dilute.
 */
export function repStats(activity: Pick<Activity, 'splits'>): { reps: number; paceSecPerKm: number; avgHr: number | null } | null {
  const reps = (activity.splits ?? []).filter((s) => s.type === 'interval_active' && s.durationSec >= MIN_REP_SECONDS && s.distanceM > 0)
  if (reps.length < 2) return null
  const seconds = reps.reduce((sum, s) => sum + s.durationSec, 0)
  const metres = reps.reduce((sum, s) => sum + s.distanceM, 0)
  const hr = average(reps.map((s) => s.avgHr).filter((h): h is number => h !== null))
  return { reps: reps.length, paceSecPerKm: Math.round((seconds / metres) * 1000), avgHr: hr === null ? null : Math.round(hr) }
}
