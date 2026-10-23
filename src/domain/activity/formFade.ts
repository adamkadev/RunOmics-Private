import { round } from '@/lib/math'
import { cleanStream } from './cleanStream'

export interface FormFade {
  fadedFromKm: number | null
  referenceSpm: number
}

/** Below this the watch is reporting a walk or a stop, not a running cadence. */
const MIN_CADENCE_SPM = 60

const REFERENCE_START = 0.1
const REFERENCE_END = 0.6
const FADE_RATIO = 0.985
const WINDOW_FRACTION = 0.05
const MIN_SAMPLES = 20
const MIN_REFERENCE_SAMPLES = 5

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Cadence is the only form metric recorded per sample, so it stands in for the mechanics the scalar dynamics summarise. */
export function formFade(cadenceSamples: number[] | null, distanceKm: number): FormFade | null {
  if (!cadenceSamples || cadenceSamples.length < MIN_SAMPLES || distanceKm <= 0) return null

  // The figure reads the same cleaned stream, so it never shows a dropout this verdict didn't see.
  const values = cleanStream(cadenceSamples, { min: MIN_CADENCE_SPM, max: 250, spikeFloor: 25 })
  const n = values.length
  const running = (v: number | null | undefined): v is number => v != null

  const referenceStart = Math.floor(n * REFERENCE_START)
  const referenceEnd = Math.floor(n * REFERENCE_END)
  const referenceSamples = values.slice(referenceStart, referenceEnd).filter(running)
  if (referenceSamples.length < MIN_REFERENCE_SAMPLES) return null

  const reference = mean(referenceSamples)
  const referenceSpm = Math.round(reference)
  const threshold = reference * FADE_RATIO
  const windowSize = Math.max(3, Math.round(n * WINDOW_FRACTION))

  // A dip that came back by the finish is a hill or a road crossing, not the mechanics giving out.
  const tail = values.slice(n - windowSize).filter(running)
  if (tail.length === 0 || mean(tail) >= threshold) return { fadedFromKm: null, referenceSpm }

  for (let i = referenceEnd; i <= n - windowSize; i++) {
    const window = values.slice(i, i + windowSize).filter(running)
    if (window.length < windowSize || mean(window) >= threshold) continue

    // The window straddles the drop, so report the first sample actually below it.
    const dropped = values.findIndex((v, j) => j >= i && running(v) && v < threshold)
    return {
      fadedFromKm: round(((dropped >= 0 ? dropped : i) / (n - 1)) * distanceKm, 1),
      referenceSpm,
    }
  }

  return { fadedFromKm: null, referenceSpm }
}
