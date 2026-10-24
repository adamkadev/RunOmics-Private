import type { ActivitySplit } from './types'
import { median, round } from '@/lib/math'

export interface RepRecovery {
  durationSec: number
  distanceM: number
  paceSecPerKm: number | null
  avgHr: number | null
}

export interface Rep {
  number: number
  durationSec: number
  distanceM: number
  paceSecPerKm: number | null
  avgHr: number | null
  recovery: RepRecovery | null
}

/** Pooled: total time over total distance, heart rate weighted by time. */
export function recoveryAverage(reps: Rep[]): { paceSecPerKm: number | null; avgHr: number | null } | null {
  const recs = reps.map((r) => r.recovery).filter((r): r is RepRecovery => r !== null)
  if (recs.length === 0) return null
  const seconds = recs.reduce((sum, r) => sum + r.durationSec, 0)
  const metres = recs.reduce((sum, r) => sum + r.distanceM, 0)
  const withHr = recs.filter((r) => r.avgHr !== null)
  const hrSeconds = withHr.reduce((sum, r) => sum + r.durationSec, 0)
  return {
    paceSecPerKm: metres > 0 ? Math.round((seconds / metres) * 1000) : null,
    avgHr: hrSeconds > 0 ? Math.round(withHr.reduce((sum, r) => sum + r.avgHr! * r.durationSec, 0) / hrSeconds) : null,
  }
}

export interface RepSet {
  reps: Rep[]
  /** In order: a warm-up often comes in parts, easy then steady. */
  warmups: ActivitySplit[]
  cooldowns: ActivitySplit[]
  /** The run itself when the watch typed it as a rep: the 8 km an easy run's strides follow. */
  body: ActivitySplit | null
  /** 30 s reps after a body: accelerations to list, not a set to grade against a band. */
  strides: boolean
  repDurationSec: number
  band: { min: number; max: number } | null
  inBand: number
  spreadSecPerKm: number | null
  hrDriftBpm: number | null
}

const RECOVERY_TYPES = new Set(['interval_rest', 'interval_recovery'])
const MIN_REPS = 2

/** A first rep this much slower than the rest is a lead-in: not every watch types its warm-up as one. */
const LEAD_IN_RATIO = 1.15
const MIN_REPS_TO_DROP_LEAD_IN = 3

const STRIDE_MAX_SEC = 30
/** A body is a run of its own; a shorter first lap before short reps is a warm-up jog the watch typed as work. */
const BODY_MIN_SEC = 15 * 60

/** Half-width, in seconds per km. */
export const BAND_TOLERANCE_SEC = 10

function paceSecPerKm(durationSec: number, distanceM: number): number | null {
  return distanceM > 0 ? Math.round((durationSec / distanceM) * 1000) : null
}

function takeLeadIn(reps: Rep[]): Rep | null {
  if (reps.length < MIN_REPS_TO_DROP_LEAD_IN) return null

  const first = reps[0]?.paceSecPerKm
  const rest = reps.slice(1).map((r) => r.paceSecPerKm).filter((p): p is number => p !== null)
  if (first == null || rest.length < MIN_REPS) return null

  return first > median(rest) * LEAD_IN_RATIO ? reps[0]! : null
}

export function repSet(splits: ActivitySplit[] | null): RepSet | null {
  if (!splits) return null
  const active = splits.filter((s) => s.type === 'interval_active')
  if (active.length < MIN_REPS) return null

  const reps: Rep[] = []
  const repSplits: ActivitySplit[] = []
  const warmups: ActivitySplit[] = []
  const cooldowns: ActivitySplit[] = []

  splits.forEach((split, i) => {
    if (split.type === 'interval_warmup') {
      warmups.push(split)
      return
    }
    if (split.type === 'interval_cooldown') {
      cooldowns.push(split)
      return
    }
    if (split.type !== 'interval_active') return

    const next = splits[i + 1]
    const recovery =
      next && RECOVERY_TYPES.has(next.type)
        ? {
            durationSec: next.durationSec,
            distanceM: next.distanceM,
            paceSecPerKm: paceSecPerKm(next.durationSec, next.distanceM),
            avgHr: next.avgHr,
          }
        : null

    reps.push({
      number: reps.length + 1,
      durationSec: split.durationSec,
      distanceM: split.distanceM,
      paceSecPerKm: paceSecPerKm(split.durationSec, split.distanceM),
      avgHr: split.avgHr,
      recovery,
    })
    repSplits.push(split)
  })

  let body: ActivitySplit | null = null
  // Longer than every other rep together: the run the strides follow, not a lead-in before a set.
  const first = reps[0]!.durationSec
  if (reps.length > MIN_REPS && first >= BODY_MIN_SEC && first > reps.slice(1).reduce((sum, r) => sum + r.durationSec, 0)) {
    body = repSplits.shift()!
    reps.shift()
    reps.forEach((r, i) => (r.number = i + 1))
  } else if (takeLeadIn(reps)) {
    // The lap still happened, so it moves to the warm-up rows rather than vanishing.
    warmups.push(repSplits[0]!)
    reps.shift()
    reps.forEach((r, i) => (r.number = i + 1))
  }
  if (reps.length < MIN_REPS) return null

  const paces = reps.map((r) => r.paceSecPerKm).filter((p): p is number => p !== null)
  const band =
    paces.length > 0
      ? {
          min: Math.round(median(paces)) - BAND_TOLERANCE_SEC,
          max: Math.round(median(paces)) + BAND_TOLERANCE_SEC,
        }
      : null

  const hrs = reps.map((r) => r.avgHr).filter((hr): hr is number => hr !== null)

  return {
    reps,
    warmups,
    cooldowns,
    body,
    strides: body !== null && median(reps.map((r) => r.durationSec)) <= STRIDE_MAX_SEC,
    repDurationSec: Math.round(median(reps.map((r) => r.durationSec))),
    band,
    inBand: band ? paces.filter((p) => p >= band.min && p <= band.max).length : 0,
    spreadSecPerKm: paces.length >= 2 ? Math.max(...paces) - Math.min(...paces) : null,
    hrDriftBpm: hrs.length >= 2 ? hrs[hrs.length - 1]! - hrs[0]! : null,
  }
}

export interface Track {
  slow: number
  fast: number
}

const TRACK_PAD_SEC = 4

export function trackDomain(set: RepSet): Track | null {
  const paces = set.reps.map((r) => r.paceSecPerKm).filter((p): p is number => p !== null)
  if (paces.length === 0) return null

  const slowest = set.band ? Math.max(...paces, set.band.max) : Math.max(...paces)
  const fastest = set.band ? Math.min(...paces, set.band.min) : Math.min(...paces)
  return { slow: slowest + TRACK_PAD_SEC, fast: fastest - TRACK_PAD_SEC }
}

/** 0 at the slow end, 1 at the fast end. */
export function trackPosition(paceSecPerKm: number, track: Track): number {
  const span = track.slow - track.fast
  if (span <= 0) return 0.5
  return round(Math.min(1, Math.max(0, (track.slow - paceSecPerKm) / span)), 3)
}
