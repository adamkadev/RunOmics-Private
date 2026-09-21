import type { Activity } from './types'
import { round } from '@/lib/math'

export interface AerobicDecoupling {
  percent: number
  drift: 'stable' | 'drifting'
}

const MIN_DURATION_SECONDS = 1800

const MIN_PACE_SEC_PER_KM = 150
const MAX_PACE_SEC_PER_KM = 900
const MIN_HR_BPM = 90

const MIN_VALID_SAMPLES = 60

const DRIFT_THRESHOLD_PERCENT = 5

function isIntervalSession(activity: Pick<Activity, 'splits'>): boolean {
  return (activity.splits ?? []).filter((s) => s.type === 'interval_active').length >= 2
}

function efficiency(samples: [number, number][]): number {
  return samples.reduce((sum, [pace, hr]) => sum + 1 / (pace * hr), 0) / samples.length
}

export function aerobicDecoupling(
  activity: Pick<Activity, 'paceSamples' | 'hrSamples' | 'durationSeconds' | 'splits'>,
): AerobicDecoupling | null {
  const { paceSamples, hrSamples } = activity
  if (!paceSamples || !hrSamples || paceSamples.length !== hrSamples.length) return null
  if (activity.durationSeconds < MIN_DURATION_SECONDS || isIntervalSession(activity)) return null

  const running = paceSamples
    .map((pace, i): [number, number] => [pace, hrSamples[i]!])
    .filter(
      ([pace, hr]) =>
        pace >= MIN_PACE_SEC_PER_KM && pace <= MAX_PACE_SEC_PER_KM && hr >= MIN_HR_BPM,
    )

  if (running.length < MIN_VALID_SAMPLES) return null

  const half = Math.floor(running.length / 2)
  const first = efficiency(running.slice(0, half))
  const second = efficiency(running.slice(half))

  const percent = round(((first - second) / first) * 100, 1)
  return { percent, drift: percent < DRIFT_THRESHOLD_PERCENT ? 'stable' : 'drifting' }
}
