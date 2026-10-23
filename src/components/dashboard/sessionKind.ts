import type { ActivityType } from '@/domain/activity/types'
import type { CoachingWorkoutType } from '@/domain/coaching/types'
import { isActivityType } from '@/domain/activity/types'

/** A session's kind in the coach's words: the plan's and a run's alike. */
export type SessionKind = CoachingWorkoutType

const KIND_OF_TYPE: Record<ActivityType, SessionKind> = {
  Base: 'easy',
  Tempo: 'tempo',
  Threshold: 'threshold',
  VO2Max: 'vo2max',
  Anaerobic: 'anaerobic',
  Sprint: 'sprint',
  Race: 'race',
}

/** A type this build does not know reads as easy. */
export function kindOfType(type: string | null | undefined): SessionKind {
  return isActivityType(type) ? KIND_OF_TYPE[type] : 'easy'
}
