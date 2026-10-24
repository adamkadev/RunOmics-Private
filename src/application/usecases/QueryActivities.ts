import { getActivities } from './GetActivities'
import { toActivitySummary } from '@/domain/activity/summary'
import { queryRuns, type RunQuery } from '@/domain/activity/activityQuery'
import type { ActivitySummary } from '@/domain/activity/types'

export { LONG_RUN_KIND, type ActivityQueryKind, type ActivitySortKey, type ActivitySortOrder } from '@/domain/activity/activityQuery'

export interface ActivityQueryParams extends RunQuery {
  offset?: number
  limit?: number
}

export interface ActivityQueryResult {
  items: ActivitySummary[]
  total: number
  nextOffset: number | null
}

export function queryActivities({ offset = 0, limit = 20, ...query }: ActivityQueryParams): ActivityQueryResult {
  const sorted = queryRuns(getActivities(), query)
  const page = sorted.slice(offset, offset + limit)
  const nextOffset = offset + limit < sorted.length ? offset + limit : null

  return { items: page.map(toActivitySummary), total: sorted.length, nextOffset }
}
