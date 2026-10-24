import { formatWeekdayLong } from '@/lib/formatters'
import { isLongSession } from './longRun'
import type { Activity, ActivityType } from './types'

/** The classifier has no long-run type, so the query derives one; a plain "Base" is the easy running left. */
export const LONG_RUN_KIND = 'LongRun'
export type ActivityQueryKind = ActivityType | typeof LONG_RUN_KIND

export type ActivitySortKey = 'date' | 'distance' | 'duration' | 'pace' | 'avgHr'
export type ActivitySortOrder = 'asc' | 'desc'

export type QueryableRun = Pick<
  Activity,
  'date' | 'dayOfWeek' | 'type' | 'description' | 'comment' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm' | 'avgHeartRate'
> & { gearId?: string | null }

export interface RunQuery {
  /** Runs of these kinds; null or empty is every run. */
  types?: readonly ActivityQueryKind[] | null
  gearId?: string | null
  search?: string
  sortBy?: ActivitySortKey
  sortOrder?: ActivitySortOrder
}

function matchesKind(run: QueryableRun, kind: ActivityQueryKind): boolean {
  if (kind === LONG_RUN_KIND) return run.type === 'Base' && isLongSession(run)
  if (kind === 'Base') return run.type === 'Base' && !isLongSession(run)
  return run.type === kind
}

function sortValue(run: QueryableRun, key: ActivitySortKey): number {
  switch (key) {
    case 'date':
      return new Date(run.date).getTime()
    case 'distance':
      return run.distanceKm
    case 'duration':
      return run.durationSeconds
    case 'pace':
      return run.paceSecPerKm ?? Infinity
    case 'avgHr':
      return run.avgHeartRate ?? -Infinity
  }
}

/** The API and the list on the phone both answer with this, so a filter reads the same wherever it runs. */
export function queryRuns<T extends QueryableRun>(
  runs: readonly T[],
  { types = null, gearId = null, search = '', sortBy = 'date', sortOrder = 'desc' }: RunQuery,
): T[] {
  const q = search.trim().toLowerCase()
  const filtered = runs
    .filter((a) => !types?.length || types.some((kind) => matchesKind(a, kind)))
    .filter((a) => !gearId || a.gearId === gearId)
    .filter(
      (a) =>
        !q ||
        a.description.toLowerCase().includes(q) ||
        a.comment.toLowerCase().includes(q) ||
        a.dayOfWeek.toLowerCase().includes(q) ||
        formatWeekdayLong(a.date).toLowerCase().includes(q) ||
        a.date.includes(q),
    )
  const direction = sortOrder === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => direction * (sortValue(a, sortBy) - sortValue(b, sortBy)))
}
