import { median } from '@/lib/math'

export interface CleanStreamOptions {
  /** Values outside these bounds are the watch reporting a stop, not a run. */
  min?: number
  max?: number
  /** Leading distance to drop while GPS settles. */
  settleKm?: number
  distanceKm?: number
  /** An absolute gap a spike must also clear, so a flat series' tiny MAD doesn't filter out its ordinary wobble. */
  spikeFloor?: number
}

const SPIKE_MAD_FACTOR = 6
const MIN_SAMPLES_FOR_SPIKES = 12

/** Every figure drawn from a stream goes through here: the GPS settle and dropouts are the watch's artifacts, not the run's. */
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

/** In samples; a longer dropout breaks the line. */
const MAX_BRIDGED_GAP = 2

/** A one-sample dropout is the watch blinking, not the runner stopping; a break drawn for it reads as a cliff. */
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

/** A 5 m elevation wobble drawn edge to edge reads as a mountain range. */
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
