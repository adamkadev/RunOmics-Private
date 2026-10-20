import { getActivities } from './GetActivities'
import { toActivitySummary } from '@/domain/activity/summary'
import type { Activity, ActivitySummary, ActivityType } from '@/domain/activity/types'
import { formatWeekdayLong } from '@/lib/formatters'
import { isLongSession } from '@/domain/activity/longRun'

export type ActivitySortKey = 'date' | 'distance' | 'duration' | 'pace' | 'avgHr'
export type ActivitySortOrder = 'asc' | 'desc'

/**
 * The long run as a filter of its own (App Fixes 3d). The classifier has no
 * such type - a long run is a Base run - so the query derives it, and a
 * plain "Base" then means the easy running that is left.
 */
export const LONG_RUN_KIND = 'LongRun'
export type ActivityQueryKind = ActivityType | typeof LONG_RUN_KIND

export interface ActivityQueryParams {
  /** Runs of these kinds; null or empty is every run. */
  types?: readonly ActivityQueryKind[] | null
  /** Runs in one pair of shoes: the shoe page's "All 136 ›" (G29). */
  gearId?: string | null
  search?: string
  sortBy?: ActivitySortKey
  sortOrder?: ActivitySortOrder
  offset?: number
  limit?: number
}

export interface ActivityQueryResult {
  items: ActivitySummary[]
  total: number
  nextOffset: number | null
}

/** Whether a run is of a kind the filter asked for. */
function matchesKind(activity: Activity, kind: ActivityQueryKind): boolean {
  if (kind === LONG_RUN_KIND) return activity.type === 'Base' && isLongSession(activity)
  if (kind === 'Base') return activity.type === 'Base' && !isLongSession(activity)
  return activity.type === kind
}

function sortValue(a: Activity, key: ActivitySortKey): number {
  switch (key) {
    case 'date':
      return new Date(a.date).getTime()
    case 'distance':
      return a.distanceKm
    case 'duration':
      return a.durationSeconds
    case 'pace':
      return a.paceSecPerKm ?? Infinity
    case 'avgHr':
      return a.avgHeartRate ?? -Infinity
  }
}

export function queryActivities({
  types = null,
  gearId = null,
  search = '',
  sortBy = 'date',
  sortOrder = 'desc',
  offset = 0,
  limit = 20,
}: ActivityQueryParams): ActivityQueryResult {
  const q = search.trim().toLowerCase()

  const filtered = getActivities()
    .filter((a) => !types?.length || types.some((kind) => matchesKind(a, kind)))
    .filter((a) => !gearId || a.gearId === gearId)
    .filter(
      (a) =>
        !q ||
        a.description.toLowerCase().includes(q) ||
        a.comment.toLowerCase().includes(q) ||
        a.dayOfWeek.toLowerCase().includes(q) ||
        formatWeekdayLong(a.date).toLowerCase().includes(q) ||
        a.date.includes(q)
    )

  const direction = sortOrder === 'asc' ? 1 : -1
  const sorted = [...filtered].sort((a, b) => direction * (sortValue(a, sortBy) - sortValue(b, sortBy)))

  const page = sorted.slice(offset, offset + limit)
  const nextOffset = offset + limit < sorted.length ? offset + limit : null

  return { items: page.map(toActivitySummary), total: sorted.length, nextOffset }
}
