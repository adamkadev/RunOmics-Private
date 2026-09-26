import { getActivities } from './GetActivities'
import { toActivitySummary } from '@/domain/activity/summary'
import type { Activity, ActivitySummary, ActivityType } from '@/domain/activity/types'

export type ActivitySortKey = 'date' | 'distance' | 'duration' | 'pace' | 'avgHr'
export type ActivitySortOrder = 'asc' | 'desc'

export interface ActivityQueryParams {
  type?: ActivityType | null
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
  type = null,
  gearId = null,
  search = '',
  sortBy = 'date',
  sortOrder = 'desc',
  offset = 0,
  limit = 20,
}: ActivityQueryParams): ActivityQueryResult {
  const q = search.trim().toLowerCase()

  const filtered = getActivities()
    .filter((a) => !type || a.type === type)
    .filter((a) => !gearId || a.gearId === gearId)
    .filter(
      (a) =>
        !q ||
        a.description.toLowerCase().includes(q) ||
        a.comment.toLowerCase().includes(q) ||
        a.dayOfWeek.toLowerCase().includes(q) ||
        a.date.includes(q)
    )

  const direction = sortOrder === 'asc' ? 1 : -1
  const sorted = [...filtered].sort((a, b) => direction * (sortValue(a, sortBy) - sortValue(b, sortBy)))

  const page = sorted.slice(offset, offset + limit)
  const nextOffset = offset + limit < sorted.length ? offset + limit : null

  return { items: page.map(toActivitySummary), total: sorted.length, nextOffset }
}
