import type { Activity } from './types'

export const LONG_RUN_SECONDS = 90 * 60

export function isLongRun(activity: Pick<Activity, 'durationSeconds'>): boolean {
  return activity.durationSeconds >= LONG_RUN_SECONDS
}

const LONG_NAME = /\blong\b|\blongue\b/i

/** Matches a plan's "Long run" or « Sortie longue ». */
export function isLongName(name: string | null | undefined): boolean {
  return LONG_NAME.test(name ?? '')
}

/**
 * A 70-minute "Long run" is the long run of a 35 km week, whatever the 90-minute rule says.
 * For comparing like with like, never for the RPE band, which stays on the clock.
 */
export function isLongSession(activity: Pick<Activity, 'durationSeconds' | 'description'>): boolean {
  return isLongRun(activity) || isLongName(activity.description)
}
