import type { Activity, ActivityType } from '@/domain/activity/types'

/** What Plan draws of a run: its route thumbnail, notes and the rest stay off the payload the tab bar prefetches. */
export type PlanRun = Pick<Activity, 'id' | 'date' | 'type' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm' | 'avgHeartRate'> & {
  /** The session the run was set as, else its intended type: what "as planned" compares. */
  shownType: ActivityType
}

export function planRun(
  { id, date, type, description, distanceKm, durationSeconds, paceSecPerKm, avgHeartRate }: Activity,
  shownType: ActivityType,
): PlanRun {
  return { id, date, type, description, distanceKm, durationSeconds, paceSecPerKm, avgHeartRate, shownType }
}
