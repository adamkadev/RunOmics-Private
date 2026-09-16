export interface KmSplit {
  km: number
  distanceKm: number
  durationSec: number
  paceSecPerKm: number
  avgHr: number | null
}

export interface KmSplitInput {
  distanceKm: number
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

  return buckets
    .map((bucket, index) => ({ index, ...bucket }))
    .filter((bucket) => bucket.distanceKm >= MIN_PARTIAL_KM && bucket.durationSec > 0)
    .map(({ index, distanceKm: km, durationSec }) => ({
      km: index + 1,
      distanceKm: Number(km.toFixed(2)),
      durationSec: Math.round(durationSec),
      paceSecPerKm: Math.round(durationSec / km),
      avgHr: meanHrOver(hrSamples, (index * 1) / distanceKm, Math.min(index + km, distanceKm) / distanceKm),
    }))
}
