import type { Activity, ActivityType } from './types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'
import { sessionForRun, type RunSession, type SessionRun } from '@/domain/coaching/sessionForRun'

export type TypedSession = RunSession<Pick<WorkoutPrescription, 'date' | 'type' | 'status'> & { title?: string }>

type Typed = SessionRun & Pick<Activity, 'typeSource'>

/** Garmin's Training Effect label measured the run; only a type RunOmics guessed yields to the session it was set as. */
export function effectiveType(activity: Typed, sessions: readonly TypedSession[]): ActivityType {
  if (activity.typeSource !== 'runomics') return activity.type
  const session = sessionForRun(activity, sessions)
  return session ? COACHING_TO_ACTIVITY_TYPE[session.type] : activity.type
}

export function withEffectiveTypes<T extends Typed>(activities: readonly T[], sessions: readonly TypedSession[]): T[] {
  return activities.map((activity) => {
    const type = effectiveType(activity, sessions)
    return type === activity.type ? activity : { ...activity, type }
  })
}
