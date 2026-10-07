export interface KmSplit {
  km: number
  distanceKm: number
  durationSec: number
  paceSecPerKm: number
  avgHr: number | null
}

export interface KmSplitInput {
  distanceKm: number
  durationSec?: number | null
  paceSamples: number[] | null
  hrSamples: number[] | null
  avgPaceSecPerKm: number | null
}

const MIN_PARTIAL_KM = 0.05

/**
 * A pace sample this much slower than the run's median is a stop, or the
 * start backfilled with the first reading: on the wall clock but not on the
 * timer the splits are scaled to, so kept in, its time leaks into every km.
 */
const STOP_PACE_FACTOR = 1.5

function sampleAt(samples: (number | null)[], fraction: number): number | null {
  const i = Math.round(fraction * (samples.length - 1))
  const v = samples[Math.min(Math.max(i, 0), samples.length - 1)]
  return typeof v === 'number' && v > 0 ? v : null
}

/** The samples with stops left out, as gaps the neighbouring readings fill. */
function withoutStops(samples: number[]): (number | null)[] {
  const valid = samples.filter((v) => typeof v === 'number' && v > 0).sort((a, b) => a - b)
  if (!valid.length) return samples
  const median = valid[Math.floor(valid.length / 2)]!
  return samples.map((v) => (typeof v === 'number' && v > 0 && v <= median * STOP_PACE_FACTOR ? v : null))
}

function meanHrOver(hrSamples: number[] | null, fromFraction: number, toFraction: number): number | null {
  if (!hrSamples || hrSamples.length === 0) return null

  const last = hrSamples.length - 1
  const from = Math.max(0, Math.floor(fromFraction * last))
  const to = Math.min(last, Math.ceil(toFraction * last))
  const covered = hrSamples.slice(from, to + 1).filter((v) => typeof v === 'number' && v > 0)
  if (covered.length === 0) return null

  return Math.round(covered.reduce((s, v) => s + v, 0) / covered.length)
}

export function kmSplitsFromSamples({
  distanceKm,
  durationSec,
  paceSamples,
  hrSamples,
  avgPaceSecPerKm,
}: KmSplitInput): KmSplit[] {
  if (distanceKm <= 0 || !paceSamples || paceSamples.length < 2) return []

  const segments = paceSamples.length - 1
  const segmentKm = distanceKm / segments
  const fallbackPace = avgPaceSecPerKm && avgPaceSecPerKm > 0 ? avgPaceSecPerKm : null
  const samples = withoutStops(paceSamples)

  const buckets: { distanceKm: number; durationSec: number }[] = []
  for (let s = 0; s < segments; s++) {
    const startKm = s * segmentKm
    const pace =
      sampleAt(samples, s / segments) ?? sampleAt(samples, (s + 1) / segments) ?? fallbackPace
    if (pace === null) continue

    let remaining = segmentKm
    let cursor = startKm
    while (remaining > 1e-9) {
      const index = Math.floor(cursor + 1e-9)
      const roomInKm = index + 1 - cursor
      const take = Math.min(remaining, roomInKm)
      const bucket = (buckets[index] ??= { distanceKm: 0, durationSec: 0 })
      bucket.distanceKm += take
      bucket.durationSec += take * pace
      remaining -= take
      cursor += take
    }
  }

  const derivedSec = buckets.reduce((sum, bucket) => sum + (bucket?.durationSec ?? 0), 0)
  const calibration = durationSec && derivedSec > 0 ? durationSec / derivedSec : 1

  return buckets
    .map((bucket, index) => ({ index, ...bucket, durationSec: bucket.durationSec * calibration }))
    .filter((bucket) => bucket.distanceKm >= MIN_PARTIAL_KM && bucket.durationSec > 0)
    .map(({ index, distanceKm: km, durationSec }) => ({
      km: index + 1,
      distanceKm: Number(km.toFixed(2)),
      durationSec: Math.round(durationSec),
      paceSecPerKm: Math.round(durationSec / km),
      avgHr: meanHrOver(hrSamples, (index * 1) / distanceKm, Math.min(index + km, distanceKm) / distanceKm),
    }))
}

/** A watch's own laps, on its timer: the one record of where each kilometre ended. */
export interface LapInput {
  durationSec: number
  distanceM: number
  avgHr: number | null
}

/** Laps that leave more than this share of the run's distance unaccounted for are not its laps. */
const LAP_COVERAGE_TOLERANCE = 0.03

/**
 * Kilometres from the watch's laps (design review, Oct 2026): the time at
 * each 1000 m, interpolated inside the lap that crosses it, and each km's
 * heart rate weighted by the time it spent in each lap. The 150 pace samples
 * the splits were rebuilt from are one wall-clock reading every ~67 m, so a
 * backfilled start and one stop leaked ~95 s into every km through the
 * calibration: km 10 of a 6:00 /km run read 5:43, faster than the run's
 * best kilometre.
 */
export function kmSplitsFromLaps(laps: readonly LapInput[], distanceKm: number): KmSplit[] {
  const totalM = laps.reduce((sum, lap) => sum + Math.max(0, lap.distanceM), 0)
  if (laps.length < 2 || totalM <= 0) return []
  if (distanceKm > 0 && Math.abs(totalM - distanceKm * 1000) > distanceKm * 1000 * LAP_COVERAGE_TOLERANCE) return []

  const kms: { distanceM: number; durationSec: number; hrSeconds: number; hrWeighted: number }[] = []
  const kmAt = (index: number) => (kms[index] ??= { distanceM: 0, durationSec: 0, hrSeconds: 0, hrWeighted: 0 })
  let cursorM = 0
  for (const lap of laps) {
    const lapM = Math.max(0, lap.distanceM)
    if (lap.durationSec <= 0) continue
    if (lapM === 0) {
      // A lap without distance is a stop: its time belongs to the km it stopped in.
      const km = kmAt(Math.min(Math.floor(cursorM / 1000), Math.max(0, Math.ceil(totalM / 1000) - 1)))
      km.durationSec += lap.durationSec
      if (lap.avgHr) { km.hrSeconds += lap.durationSec; km.hrWeighted += lap.avgHr * lap.durationSec }
      continue
    }
    let remainingM = lapM
    while (remainingM > 1e-6) {
      const index = Math.floor(cursorM / 1000 + 1e-9)
      const takeM = Math.min(remainingM, (index + 1) * 1000 - cursorM)
      const sec = (takeM / lapM) * lap.durationSec
      const km = kmAt(index)
      km.distanceM += takeM
      km.durationSec += sec
      if (lap.avgHr) { km.hrSeconds += sec; km.hrWeighted += lap.avgHr * sec }
      remainingM -= takeM
      cursorM += takeM
    }
  }

  return kms
    .map((km, index) => ({ index, ...km }))
    .filter((km) => km.distanceM / 1000 >= MIN_PARTIAL_KM && km.durationSec > 0)
    .map(({ index, distanceM, durationSec, hrSeconds, hrWeighted }) => ({
      km: index + 1,
      distanceKm: Number((distanceM / 1000).toFixed(2)),
      durationSec: Math.round(durationSec),
      paceSecPerKm: Math.round(durationSec / (distanceM / 1000)),
      avgHr: hrSeconds > 0 ? Math.round(hrWeighted / hrSeconds) : null,
    }))
}

/** A run's kilometres: from its laps when the watch kept them, else rebuilt from its pace samples. */
export function kmSplitsOf(input: KmSplitInput & { laps?: readonly LapInput[] | null }): KmSplit[] {
  const fromLaps = input.laps ? kmSplitsFromLaps(input.laps, input.distanceKm) : []
  return fromLaps.length > 1 ? fromLaps : kmSplitsFromSamples(input)
}

export type SplitSpreadKind = 'even' | 'negative' | 'faded' | 'uneven'

export interface SplitSpread {
  fastest: KmSplit
  slowest: KmSplit
  /** Slowest minus fastest, in s/km. */
  spread: number
  kind: SplitSpreadKind
}

/** A spread this small, in s/km, reads as an even run. */
const EVEN_SPREAD = 15
/** A half this much faster or slower than the other, in s/km, is a trend. */
const HALF_TREND = 5

/**
 * How even the run was, from its full kilometres: the fastest, the slowest and
 * the gap between them, and whether the second half ran faster (a negative
 * split), slower (faded) or neither. A partial last kilometre is left out - a
 * 110 m sprint to the door is not a kilometre.
 */
export function splitSpread(splits: KmSplit[]): SplitSpread | null {
  const full = splits.filter((s) => s.distanceKm >= 0.99)
  if (full.length < 2) return null

  const fastest = full.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a))
  const slowest = full.reduce((a, b) => (b.paceSecPerKm > a.paceSecPerKm ? b : a))
  const spread = Math.round(slowest.paceSecPerKm - fastest.paceSecPerKm)

  const half = Math.floor(full.length / 2)
  const mean = (xs: KmSplit[]) => xs.reduce((sum, s) => sum + s.paceSecPerKm, 0) / xs.length
  const trend = mean(full.slice(full.length - half)) - mean(full.slice(0, half))

  const kind: SplitSpreadKind =
    spread <= EVEN_SPREAD ? 'even' : trend <= -HALF_TREND ? 'negative' : trend >= HALF_TREND ? 'faded' : 'uneven'
  return { fastest, slowest, spread, kind }
}
