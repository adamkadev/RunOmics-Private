import { median } from '@/lib/math'

export interface CleanStreamOptions {
  /** Values outside these bounds are the watch reporting a stop, not a run. */
  min?: number
  max?: number
  /** Leading samples to drop while GPS settles, as a distance. */
  settleKm?: number
  distanceKm?: number
  /**
   * A spike has to clear both this many MADs and this absolute gap, so a flat
   * series with a tiny MAD does not have its ordinary wobble filtered away.
   */
  spikeFloor?: number
}

const SPIKE_MAD_FACTOR = 6
const MIN_SAMPLES_FOR_SPIKES = 12

/**
 * One cleaning pass for every recorded stream. The km-0 GPS settle and mid-run
 * dropouts are artifacts of the watch, not of the run, and a figure that plots
 * them argues about the wrong thing - so every figure drawn from a stream goes
 * through here first, and the gaps come back as nulls for the chart to skip.
 */
export function cleanStream(
  samples: number[] | null | undefined,
  options: CleanStreamOptions = {},
): (number | null)[] {
  if (!samples) return []
  const { min = -Infinity, max = Infinity, settleKm = 0, distanceKm, spikeFloor = 0 } = options

  const settleSamples =
    settleKm > 0 && distanceKm && distanceKm > 0
      ? Math.floor((settleKm / distanceKm) * samples.length)
      : 0

  const plausible = samples.map((v, i) =>
    i < settleSamples || v == null || !Number.isFinite(v) || v < min || v > max ? null : v,
  )

  const present = plausible.filter((v): v is number => v !== null)
  if (present.length < MIN_SAMPLES_FOR_SPIKES) return plausible

  const mid = median(present)
  const mad = median(present.map((v) => Math.abs(v - mid)))
  const limit = Math.max(SPIKE_MAD_FACTOR * mad, spikeFloor)
  const despiked =
    limit > 0 ? plausible.map((v) => (v === null || Math.abs(v - mid) <= limit ? v : null)) : plausible

  return bridgeShortGaps(despiked)
}

/** The longest dropout worth drawing through rather than breaking the line for. */
const MAX_BRIDGED_GAP = 2

/**
 * A one-sample dropout is the watch blinking, not the runner stopping, and a
 * break drawn for it reads as a cliff. Longer gaps stay gaps.
 */
function bridgeShortGaps(values: (number | null)[]): (number | null)[] {
  const out = [...values]

  for (let i = 0; i < out.length; i++) {
    if (out[i] !== null) continue

    let end = i
    while (end < out.length && out[end] === null) end++

    const before = i > 0 ? (out[i - 1] ?? null) : null
    const after = end < out.length ? (out[end] ?? null) : null
    const span = end - i

    if (before !== null && after !== null && span <= MAX_BRIDGED_GAP) {
      for (let j = i; j < end; j++) {
        out[j] = before + ((after - before) * (j - i + 1)) / (span + 1)
      }
    }
    i = end - 1
  }

  return out
}

/**
 * A domain that never amplifies a flat series: a 5 m elevation wobble drawn
 * edge to edge reads as a mountain range.
 */
export function paddedDomain(
  values: (number | null)[],
  minSpan: number,
): [number, number] | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null

  const low = Math.min(...present)
  const high = Math.max(...present)
  const shortfall = minSpan - (high - low)
  if (shortfall <= 0) return [low, high]

  return [low - shortfall / 2, high + shortfall / 2]
}
