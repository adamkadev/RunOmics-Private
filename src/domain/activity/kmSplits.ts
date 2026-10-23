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

/** A sample this much slower than the median is a stop or the backfilled start: on the wall clock, not the timer the splits are scaled to. */
const STOP_PACE_FACTOR = 1.5

function sampleAt(samples: (number | null)[], fraction: number): number | null {
  const i = Math.round(fraction * (samples.length - 1))
  const v = samples[Math.min(Math.max(i, 0), samples.length - 1)]
  return typeof v === 'number' && v > 0 ? v : null
}

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

/** On the watch's timer: the one record of where each kilometre ended. */
export interface LapInput {
  durationSec: number
  distanceM: number
  avgHr: number | null
}

const LAP_COVERAGE_TOLERANCE = 0.03

/** Preferred to the pace samples: those are wall-clock readings every ~67 m, which a stop skews. */
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

export function kmSplitsOf(input: KmSplitInput & { laps?: readonly LapInput[] | null }): KmSplit[] {
  const fromLaps = input.laps ? kmSplitsFromLaps(input.laps, input.distanceKm) : []
  return fromLaps.length > 1 ? fromLaps : kmSplitsFromSamples(input)
}

/** Assumes the stream is spread evenly over the distance. */
function streamAt(values: readonly (number | null)[], fraction: number): number | null {
  const last = values.length - 1
  if (last < 0) return null
  const at = Math.min(Math.max(fraction, 0), 1) * last
  const i = Math.floor(at)
  const a = values[i] ?? null
  const b = values[Math.min(i + 1, last)] ?? null
  if (a === null || b === null) return a ?? b
  return a + (b - a) * (at - i)
}

/** In whole metres, from the stream laid evenly over the distance, as the Charts tab draws it. */
export function kmElevationDeltas(
  splits: readonly Pick<KmSplit, 'distanceKm'>[],
  elevation: readonly (number | null)[] | null,
  distanceKm: number,
): (number | null)[] {
  if (!elevation || elevation.length < 2 || distanceKm <= 0) return splits.map(() => null)
  let startKm = 0
  return splits.map((split) => {
    const from = streamAt(elevation, startKm / distanceKm)
    startKm += split.distanceKm
    const to = streamAt(elevation, startKm / distanceKm)
    return from === null || to === null ? null : Math.round(to - from)
  })
}

export const EVEN_SPLIT_SEC = 5

/** Negative when the second half, by distance, is the faster. */
export function halfSplitSec(splits: readonly Pick<KmSplit, 'distanceKm' | 'durationSec'>[]): number | null {
  const totalKm = splits.reduce((sum, split) => sum + split.distanceKm, 0)
  const totalSec = splits.reduce((sum, split) => sum + split.durationSec, 0)
  if (splits.length < 2 || totalKm <= 0) return null
  const halfKm = totalKm / 2
  let km = 0
  let firstSec = 0
  for (const split of splits) {
    if (km + split.distanceKm >= halfKm) {
      firstSec += split.distanceKm > 0 ? ((halfKm - km) / split.distanceKm) * split.durationSec : 0
      break
    }
    km += split.distanceKm
    firstSec += split.durationSec
  }
  return Math.round(totalSec - 2 * firstSec)
}
