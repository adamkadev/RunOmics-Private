import { isActivityType, type ActivitySummary, type ActivityType } from './types'
import { isLongSession } from './longRun'

/**
 * The kind a run is filtered by, on the Activities list and the map alike. The classifier has no long-run type (a
 * long run is a Base run), so one is derived and the rest of Base stays plain easy running.
 */
export const LONG_RUN = 'LongRun'
export type FilterKind = ActivityType | typeof LONG_RUN

export function isFilterKind(value: unknown): value is FilterKind {
  return value === LONG_RUN || isActivityType(value)
}

export function kindOfRun(activity: Pick<ActivitySummary, 'type' | 'durationSeconds' | 'description'>): FilterKind {
  return activity.type === 'Base' && isLongSession(activity) ? LONG_RUN : activity.type
}
