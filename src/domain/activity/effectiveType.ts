import type { Activity, ActivityType } from './types'
import { COACHING_TO_ACTIVITY_TYPE, type WorkoutPrescription } from '@/domain/coaching/types'

export interface TypedSession {
  prescription: Pick<WorkoutPrescription, 'date' | 'type' | 'status'>
  activityId: string | null
}

type Typed = Pick<Activity, 'id' | 'date' | 'type' | 'typeSource'>

/** Garmin's Training Effect label measured the run; only a type RunOmics guessed yields to the session it was set as. */
export function effectiveType(activity: Typed, sessions: readonly TypedSession[]): ActivityType {
  if (activity.typeSource !== 'runomics') return activity.type
  const day = activity.date.slice(0, 10)
  const sameDay = sessions.filter((s) => s.activityId === null && s.prescription.status !== 'cancelled' && s.prescription.date === day)
  const session = sessions.find((s) => s.activityId === activity.id) ?? (sameDay.length === 1 ? sameDay[0] : undefined)
  return session ? COACHING_TO_ACTIVITY_TYPE[session.prescription.type] : activity.type
}

export function withEffectiveTypes<T extends Typed>(activities: readonly T[], sessions: readonly TypedSession[]): T[] {
  return activities.map((activity) => {
    const type = effectiveType(activity, sessions)
    return type === activity.type ? activity : { ...activity, type }
  })
}
