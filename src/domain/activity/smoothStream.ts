/**
 * The Charts tab's Smoothed line (v4.17). A stream keeps its gaps: a null
 * stays null, and a window only ever averages the samples it has.
 */

/** Pace's GPS spikes are single samples a long way off; a rolling median drops them. */
export const PACE_MEDIAN_RADIUS = 6
/** Then a short moving average takes the jitter out, for every metric. */
export const MOVING_AVERAGE_RADIUS = 3

function windowOf(values: readonly (number | null)[], i: number, radius: number): number[] {
  const out: number[] = []
  for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
    const v = values[j]
    if (v != null) out.push(v)
  }
  return out
}

/** The median of the ±radius samples around each one. */
export function rollingMedian(values: readonly (number | null)[], radius: number): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null
    const w = windowOf(values, i, radius).sort((a, b) => a - b)
    // The upper middle of an even window, as the prototype takes it.
    return w[w.length >> 1] ?? v
  })
}

/** The mean of the ±radius samples around each one. */
export function movingAverage(values: readonly (number | null)[], radius: number): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null
    const w = windowOf(values, i, radius)
    return w.reduce((sum, x) => sum + x, 0) / w.length
  })
}

/**
 * Smoothed as the Charts tab draws it: pace through the rolling median first,
 * which takes out the GPS spikes a moving average would only smear; heart
 * rate, cadence and elevation have no such spikes and take the average alone.
 */
export function smoothStream(values: readonly (number | null)[], { despike = false }: { despike?: boolean } = {}): (number | null)[] {
  const base = despike ? rollingMedian(values, PACE_MEDIAN_RADIUS) : values
  return movingAverage(base, MOVING_AVERAGE_RADIUS)
}
