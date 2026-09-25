import type { Activity } from './types'

/** A run of 90 minutes or more counts as a long run, whatever its type. */
export const LONG_RUN_SECONDS = 90 * 60

export function isLongRun(activity: Pick<Activity, 'durationSeconds'>): boolean {
  return activity.durationSeconds >= LONG_RUN_SECONDS
}
