import type { Activity } from './types'
import type { CoachingWorkoutType, WorkoutBlock } from '@/domain/coaching/types'
import { intendedType } from '@/lib/activityTitle'
import { isLongSession } from './longRun'
import { repSet } from './repSet'
import { isRunWalk } from './runWalk'

/** A run by the session it was, as Plan and Today name sessions, never by the watch's Training Effect label. */
export const RUN_KINDS = ['easy', 'long', 'strides', 'runWalk', 'tempo', 'threshold', 'intervals', 'race'] as const
export type RunKind = (typeof RUN_KINDS)[number]

export type KindedRun = Pick<Activity, 'type' | 'description' | 'durationSeconds' | 'splits'>

export interface KindSession {
  type: CoachingWorkoutType
  blocks: readonly WorkoutBlock[]
}

export function hasStrides(blocks: readonly WorkoutBlock[]): boolean {
  return blocks.some((block) =>
    block.kind === 'repeat' ? block.steps.some((step) => step.kind === 'strides') : block.kind === 'strides',
  )
}

function easyKind(run: KindedRun): RunKind {
  if (isRunWalk(run, null, 'Base')) return 'runWalk'
  if (isLongSession(run)) return 'long'
  return repSet(run.splits ?? null)?.strides ? 'strides' : 'easy'
}

export function runKind(run: KindedRun, session: KindSession | null = null): RunKind {
  if (session) {
    switch (session.type) {
      case 'race':
        return 'race'
      case 'long_run':
        return 'long'
      case 'tempo':
        return 'tempo'
      case 'threshold':
        return 'threshold'
      case 'vo2max':
      case 'anaerobic':
      case 'sprint':
        return 'intervals'
      case 'easy':
      case 'recovery':
        return hasStrides(session.blocks) ? 'strides' : easyKind(run)
    }
  }
  // An easy run's strides are what the watch reads as a sprint or anaerobic session.
  switch (intendedType(run)) {
    case 'Race':
      return 'race'
    case 'Threshold':
      return 'threshold'
    case 'Tempo':
      return 'tempo'
    case 'Base':
      return easyKind(run)
    default:
      return repSet(run.splits ?? null)?.strides ? 'strides' : 'intervals'
  }
}
