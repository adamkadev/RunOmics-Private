/** A stream keeps its gaps: a null stays null, and a window only averages the samples it has. */

export const PACE_MEDIAN_RADIUS = 6
export const MOVING_AVERAGE_RADIUS = 3

function windowOf(values: readonly (number | null)[], i: number, radius: number): number[] {
  const out: number[] = []
  for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
    const v = values[j]
    if (v != null) out.push(v)
  }
  return out
}

export function rollingMedian(values: readonly (number | null)[], radius: number): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null
    const w = windowOf(values, i, radius).sort((a, b) => a - b)
    // The upper middle of an even window.
    return w[w.length >> 1] ?? v
  })
}

export function movingAverage(values: readonly (number | null)[], radius: number): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null
    const w = windowOf(values, i, radius)
    return w.reduce((sum, x) => sum + x, 0) / w.length
  })
}

/** Pace goes through the rolling median first: it drops the GPS spikes a moving average would only smear. */
export function smoothStream(values: readonly (number | null)[], { despike = false }: { despike?: boolean } = {}): (number | null)[] {
  const base = despike ? rollingMedian(values, PACE_MEDIAN_RADIUS) : values
  return movingAverage(base, MOVING_AVERAGE_RADIUS)
}
