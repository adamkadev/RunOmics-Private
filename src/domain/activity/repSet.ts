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

/**
 * The recoveries as one row (H15): their total time over their total
 * distance, and heart rate weighted by time. Null without a recovery.
 */
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
  warmup: ActivitySplit | null
  cooldown: ActivitySplit | null
  /** The rep length the set is built on, as seconds. */
  repDurationSec: number
  /** The window the reps are judged against: their own median, give or take. */
  band: { min: number; max: number } | null
  inBand: number
  spreadSecPerKm: number | null
  hrDriftBpm: number | null
  /** Mean pace across the recoveries between reps. The cooldown is not one. */
  meanRecoverySecPerKm: number | null
  firstRecoverySecPerKm: number | null
  lastRecoverySecPerKm: number | null
}

const RECOVERY_TYPES = new Set(['interval_rest', 'interval_recovery'])
const MIN_REPS = 2

/**
 * How much slower than the rest of the set a first rep has to be before it is
 * read as a lead-in rather than as work. Not every watch types its warm-up as
 * one, and an untyped lead-in lap dragged into the set wrecks the band, the
 * spread and the count all at once.
 */
const LEAD_IN_RATIO = 1.15
const MIN_REPS_TO_DROP_LEAD_IN = 3

/** Half-width of the consistency window, in seconds per km. */
export const BAND_TOLERANCE_SEC = 10

function paceSecPerKm(durationSec: number, distanceM: number): number | null {
  return distanceM > 0 ? Math.round((durationSec / distanceM) * 1000) : null
}

/** The first rep, when it is plainly a lead-in and not part of the work. */
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
  let warmup: ActivitySplit | null = null
  let cooldown: ActivitySplit | null = null

  splits.forEach((split, i) => {
    if (split.type === 'interval_warmup') {
      warmup ??= split
      return
    }
    if (split.type === 'interval_cooldown') {
      cooldown = split
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

  if (takeLeadIn(reps)) {
    // The lap still happened, so it moves to the warm-up row rather than vanishing.
    warmup ??= repSplits[0]!
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
  const recoveries = reps.map((r) => r.recovery?.paceSecPerKm ?? null).filter((p): p is number => p !== null)

  return {
    reps,
    warmup,
    cooldown,
    repDurationSec: Math.round(median(reps.map((r) => r.durationSec))),
    band,
    inBand: band ? paces.filter((p) => p >= band.min && p <= band.max).length : 0,
    spreadSecPerKm: paces.length >= 2 ? Math.max(...paces) - Math.min(...paces) : null,
    hrDriftBpm: hrs.length >= 2 ? hrs[hrs.length - 1]! - hrs[0]! : null,
    meanRecoverySecPerKm:
      recoveries.length > 0
        ? Math.round(recoveries.reduce((sum, p) => sum + p, 0) / recoveries.length)
        : null,
    firstRecoverySecPerKm: recoveries[0] ?? null,
    lastRecoverySecPerKm: recoveries.length >= 2 ? recoveries[recoveries.length - 1]! : null,
  }
}

export type SetVerdict = 'repsHeld' | 'repsHeldRecoveriesSlowed' | 'repsBuilt' | 'repsFaded'

const IN_BAND_RATIO = 0.75
const HR_DRIFT_LIMIT_BPM = 3
const RECOVERY_SLOWED_SEC = 60
const BUILD_SEC_PER_KM = 8

/** How much the reps moved first to last: positive slowed, negative got faster. */
export function repFadeSecPerKm(set: RepSet): number | null {
  const paces = set.reps.map((r) => r.paceSecPerKm).filter((p): p is number => p !== null)
  if (paces.length < 2) return null
  return paces[paces.length - 1]! - paces[0]!
}

/**
 * Whether the set held is a question about the reps landing in the band and
 * heart rate staying put, not about raw spread: one slow opener can widen the
 * spread of a set that was otherwise repeated exactly. A set that got faster
 * is judged before any of that - a progression is not a consistency failure.
 */
export function setVerdict(set: RepSet): SetVerdict {
  const fade = repFadeSecPerKm(set)
  if (fade !== null && fade <= -BUILD_SEC_PER_KM) return 'repsBuilt'

  const ratio = set.reps.length > 0 ? set.inBand / set.reps.length : 0
  const held =
    ratio >= IN_BAND_RATIO && (set.hrDriftBpm === null || set.hrDriftBpm <= HR_DRIFT_LIMIT_BPM)
  if (!held) return 'repsFaded'

  const slowed =
    set.firstRecoverySecPerKm !== null &&
    set.lastRecoverySecPerKm !== null &&
    set.lastRecoverySecPerKm - set.firstRecoverySecPerKm >= RECOVERY_SLOWED_SEC

  return slowed ? 'repsHeldRecoveriesSlowed' : 'repsHeld'
}

/** The pace range a rep bar is drawn across: every rep and the whole band, padded. */
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

/** Where a pace sits across the track, 0 at the slow end and 1 at the fast end. */
export function trackPosition(paceSecPerKm: number, track: Track): number {
  const span = track.slow - track.fast
  if (span <= 0) return 0.5
  return round(Math.min(1, Math.max(0, (track.slow - paceSecPerKm) / span)), 3)
}
