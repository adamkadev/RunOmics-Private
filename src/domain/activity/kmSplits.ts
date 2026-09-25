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

function sampleAt(samples: number[], fraction: number): number | null {
  const i = Math.round(fraction * (samples.length - 1))
  const v = samples[Math.min(Math.max(i, 0), samples.length - 1)]
  return typeof v === 'number' && v > 0 ? v : null
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

  const buckets: { distanceKm: number; durationSec: number }[] = []
  for (let s = 0; s < segments; s++) {
    const startKm = s * segmentKm
    const pace =
      sampleAt(paceSamples, s / segments) ?? sampleAt(paceSamples, (s + 1) / segments) ?? fallbackPace
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
