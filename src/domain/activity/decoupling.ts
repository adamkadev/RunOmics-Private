import type { Activity } from './types'
import { round } from '@/lib/math'

export interface AerobicDecoupling {
  /** Efficiency lost from the first half to the second. Positive = heart rate drifted up. */
  percent: number
  drift: 'stable' | 'drifting'
}

// A run has to be long enough for drift to appear at all - under half an hour
// the second half is still the warm-up settling down.
const MIN_DURATION_SECONDS = 1800

// Walking, stops and traffic lights wreck the pace/HR ratio, so only samples
// taken while actually running count.
const MIN_PACE_SEC_PER_KM = 150
const MAX_PACE_SEC_PER_KM = 900
const MIN_HR_BPM = 90

// Out of the ~150 stored samples, enough must survive filtering for each half
// to be an average rather than an anecdote.
const MIN_VALID_SAMPLES = 60

// Friel's threshold: an aerobically sound steady run holds under 5%.
const DRIFT_THRESHOLD_PERCENT = 5

function isIntervalSession(activity: Pick<Activity, 'splits'>): boolean {
  return (activity.splits ?? []).filter((s) => s.type === 'interval_active').length >= 2
}

/** Mean speed-per-heartbeat: how much ground each beat buys. */
function efficiency(samples: [number, number][]): number {
  return samples.reduce((sum, [pace, hr]) => sum + 1 / (pace * hr), 0) / samples.length
}

/**
 * Aerobic decoupling (Pa:HR): how much the pace-to-heart-rate ratio decays over a
 * steady run. Rising heart rate at an unchanged pace is the classic sign of an
 * aerobic base that runs out before the distance does.
 *
 * Null whenever the number would mislead: interval sessions (where pace is meant
 * to swing), runs too short to drift, or too few clean samples.
 */
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
