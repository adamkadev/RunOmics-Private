import type { Activity, ActivityType } from './types'

export type VerdictTone = 'positive' | 'neutral' | 'caution'

type RpeBand = [number, number]

// What each session type is meant to feel like on the 1-10 RPE scale. A run is
// judged against its own intent rather than an absolute threshold: RPE 8 is the
// whole point of a threshold session and a warning sign on an easy day.
//
// Sprint sits below VO2max on purpose: short reps with full recovery are
// maximal for a few seconds at a time but rarely leave the session as a whole
// feeling harder than a set of 3-minute intervals.
const EXPECTED_RPE: Record<Exclude<ActivityType, 'Race'>, RpeBand> = {
  Base: [1, 3],
  Tempo: [5, 7],
  Threshold: [7, 8],
  VO2Max: [8, 9],
  Anaerobic: [8, 10],
  Sprint: [6, 8],
}

// An easy run that goes long drifts upward on its own: the same athlete rates
// the last half of a two-hour run harder than the first at identical pace.
const LONG_RUN_SECONDS = 90 * 60
const LONG_RUN_DRIFT = 2

// The training-effect scale's own overreaching mark (see TrainingEffect).
const OVERREACHING_TRAINING_EFFECT = 4.8

// A race has no single expected effort - the distance sets it. A 5K is run at
// the edge, a marathon cannot be, and an ultra is mostly run below threshold.
function raceRpe(distanceKm: number): RpeBand {
  if (distanceKm <= 6) return [9, 10]
  if (distanceKm <= 12) return [8, 9]
  if (distanceKm <= 25) return [7, 9]
  if (distanceKm <= 45) return [6, 8]
  return [4, 8]
}

type Effort = Pick<Activity, 'type' | 'distanceKm' | 'durationSeconds' | 'rpe' | 'aerTrainingEffect'>

export function expectedRpe(activity: Pick<Effort, 'type' | 'distanceKm' | 'durationSeconds'>): RpeBand {
  if (activity.type === 'Race') return raceRpe(activity.distanceKm)

  const [easiest, hardest] = EXPECTED_RPE[activity.type]
  return activity.type === 'Base' && activity.durationSeconds >= LONG_RUN_SECONDS
    ? [easiest, hardest + LONG_RUN_DRIFT]
    : [easiest, hardest]
}

export function runVerdictTone(activity: Effort): VerdictTone {
  const { type, rpe, aerTrainingEffect } = activity

  // An objective overload marker, except in a race where it is the intent.
  if (type !== 'Race' && aerTrainingEffect !== null && aerTrainingEffect >= OVERREACHING_TRAINING_EFFECT) {
    return 'caution'
  }
  if (rpe === null) {
    return aerTrainingEffect !== null && aerTrainingEffect >= 3 ? 'positive' : 'neutral'
  }

  // A point either side of the band is not a mistake: heat, hills and fatigue
  // move perceived effort without changing what the session was.
  const [easiest, hardest] = expectedRpe(activity)
  if (rpe > hardest + 1) return 'caution'
  if (rpe > hardest || rpe < easiest - 1) return 'neutral'
  return 'positive'
}
