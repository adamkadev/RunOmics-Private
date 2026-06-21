export interface ComparePoint {
  d: number
  a: number | null
  b: number | null
}

/** Linear interpolation of a value at `atKm`, given samples evenly spaced over `distanceKm`. */
function sampleAt(samples: number[], distanceKm: number, atKm: number): number | null {
  if (samples.length === 0 || distanceKm <= 0) return null
  const pos = (atKm / distanceKm) * (samples.length - 1)
  const i0 = Math.floor(pos)
  const i1 = Math.min(i0 + 1, samples.length - 1)
  const frac = pos - i0
  return samples[i0] * (1 - frac) + samples[i1] * frac
}

/**
 * Merges two activities' samples onto a shared distance axis, truncated to the
 * shorter of the two distances so both series stay within recorded data.
 */
export function buildCompareSeries(
  samplesA: number[],
  distanceA: number,
  samplesB: number[],
  distanceB: number,
  points = 150
): ComparePoint[] {
  const maxDistance = Math.min(distanceA, distanceB)
  if (maxDistance <= 0) return []

  return Array.from({ length: points }, (_, i) => {
    const d = (i / (points - 1)) * maxDistance
    return {
      d,
      a: sampleAt(samplesA, distanceA, d),
      b: sampleAt(samplesB, distanceB, d),
    }
  })
}
