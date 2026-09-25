import type { Activity, ActivityType } from './types'
import { LONG_RUN_SECONDS } from './longRun'

export type VerdictTone = 'positive' | 'neutral' | 'caution'

type RpeBand = [number, number]

const EXPECTED_RPE: Record<Exclude<ActivityType, 'Race'>, RpeBand> = {
  Base: [1, 3],
  Tempo: [5, 7],
  Threshold: [7, 8],
  VO2Max: [8, 9],
  Anaerobic: [8, 10],
  Sprint: [6, 8],
}

const LONG_RUN_DRIFT = 2

const OVERREACHING_TRAINING_EFFECT = 4.8

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

  if (type !== 'Race' && aerTrainingEffect !== null && aerTrainingEffect >= OVERREACHING_TRAINING_EFFECT) {
    return 'caution'
  }
  if (rpe === null) {
    return aerTrainingEffect !== null && aerTrainingEffect >= 3 ? 'positive' : 'neutral'
  }

  const [easiest, hardest] = expectedRpe(activity)
  if (rpe > hardest + 1) return 'caution'
  if (rpe > hardest || rpe < easiest - 1) return 'neutral'
  return 'positive'
}
