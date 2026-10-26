import type { Activity } from './types'

/** 50 m a 10 km: under it, Minetti's adjustment moved none of 192 real runs by 3 s/km. */
const HILLY_M_PER_KM = 5

/** The run's grade-adjusted pace, where it climbed enough to differ from its pace; null on the flat or before a reprocess. */
export function hillyGap(activity: Pick<Activity, 'gapSecPerKm' | 'elevationGain' | 'distanceKm'>): number | null {
  const { gapSecPerKm, elevationGain, distanceKm } = activity
  if (gapSecPerKm == null || elevationGain == null || distanceKm <= 0) return null
  return elevationGain / distanceKm >= HILLY_M_PER_KM ? gapSecPerKm : null
}

export interface GapHalves {
  /** Second half's grade-adjusted pace against the first's, positive when it slowed. */
  fadeSecPerKm: number
  climbMPerKm: number
}

/** Split at half the distance, a sample's distance being its speed: the watch records about one a second. */
export function gapHalves(activity: Pick<Activity, 'gapSamples' | 'paceSamples' | 'elevationGain' | 'distanceKm'>): GapHalves | null {
  const { gapSamples, paceSamples, elevationGain, distanceKm } = activity
  if (!gapSamples || !paceSamples || gapSamples.length !== paceSamples.length || elevationGain == null || distanceKm <= 0) return null
  const climbMPerKm = elevationGain / distanceKm
  if (climbMPerKm < HILLY_M_PER_KM) return null

  const samples = paceSamples.flatMap((pace, i) => {
    const gap = gapSamples[i]!
    return pace > 0 && gap > 0 && Number.isFinite(pace) && Number.isFinite(gap) ? [{ metres: 1 / pace, gapMetres: 1 / gap }] : []
  })
  if (samples.length < 4) return null
  const total = samples.reduce((sum, s) => sum + s.metres, 0)
  let run = 0
  const split = samples.findIndex((s) => (run += s.metres) >= total / 2) + 1
  const halfGap = (half: typeof samples) => half.length / half.reduce((sum, s) => sum + s.gapMetres, 0)
  const first = samples.slice(0, split)
  const second = samples.slice(split)
  if (!first.length || !second.length) return null
  return { fadeSecPerKm: Math.round(halfGap(second) - halfGap(first)), climbMPerKm: Math.round(climbMPerKm) }
}
