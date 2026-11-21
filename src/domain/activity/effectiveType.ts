import type { Activity, ActivityType } from './types'
import { COACHING_TO_ACTIVITY_TYPE, type CoachingWorkoutType, type WorkoutPrescription } from '@/domain/coaching/types'
import { sessionForRun, type RunSession, type SessionRun } from '@/domain/coaching/sessionForRun'

/** The coach sets a check as a race; run with no race on the watch, it keeps the run's own type. */
export function sessionRunType(session: CoachingWorkoutType, activity: Pick<Activity, 'type'>): ActivityType {
  return session === 'race' && activity.type !== 'Race' ? activity.type : COACHING_TO_ACTIVITY_TYPE[session]
}

export type TypedSession = RunSession<Pick<WorkoutPrescription, 'date' | 'type' | 'status'> & { title?: string }>

type Typed = SessionRun & Pick<Activity, 'typeSource'>

/** Garmin's Training Effect label measured the run; only a type RunOmics guessed yields to the session it was set as. */
export function effectiveType(activity: Typed, sessions: readonly TypedSession[]): ActivityType {
  if (activity.typeSource !== 'runomics') return activity.type
  const session = sessionForRun(activity, sessions)
  return session ? sessionRunType(session.type, activity) : activity.type
}

export function withEffectiveTypes<T extends Typed>(activities: readonly T[], sessions: readonly TypedSession[]): T[] {
  return activities.map((activity) => {
    const type = effectiveType(activity, sessions)
    return type === activity.type ? activity : { ...activity, type }
  })
}
