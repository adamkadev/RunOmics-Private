import type { Activity } from './types'

/** A run of 90 minutes or more counts as a long run, whatever its type. */
export const LONG_RUN_SECONDS = 90 * 60

export function isLongRun(activity: Pick<Activity, 'durationSeconds'>): boolean {
  return activity.durationSeconds >= LONG_RUN_SECONDS
}

const LONG_NAME = /\blong\b|\blongue\b/i

/**
 * A long run by its length, or by the name its plan gave it: a 70-minute
 * "Long run" is the week's long run for an athlete at 35 km a week, whatever
 * the 90-minute rule says. For comparing like with like, never for the RPE
 * band, which stays on the clock.
 */
export function isLongSession(activity: Pick<Activity, 'durationSeconds' | 'description'>): boolean {
  return isLongRun(activity) || LONG_NAME.test(activity.description ?? '')
}
