import { isActivityType, type ActivitySummary, type ActivityType } from '@/domain/activity/types'
import { isLongSession } from '@/domain/activity/longRun'
import type { ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import { t } from '@/i18n'

/**
 * The classifier has no long-run type (a long run is a Base run), so the filter
 * derives one and leaves the rest of Base as plain easy running.
 */
export const LONG_RUN = 'LongRun'
export type FilterKind = ActivityType | typeof LONG_RUN

export function isFilterKind(value: unknown): value is FilterKind {
  return value === LONG_RUN || isActivityType(value)
}

export function kindOfRun(activity: Pick<ActivitySummary, 'type' | 'durationSeconds' | 'description'>): FilterKind {
  return activity.type === 'Base' && isLongSession(activity) ? LONG_RUN : activity.type
}

export type FilterGroup = 'all' | 'easy' | 'workouts' | 'races'
export type ActivitySort = 'newest' | 'oldest' | 'longest' | 'fastest'

/** Picked types win over the group, which is 'all' beside them. */
export interface ActivityFilter {
  group: FilterGroup
  types: FilterKind[]
}

export const ALL_RUNS: ActivityFilter = { group: 'all', types: [] }

export const FILTER_GROUPS = {
  easy: ['Base', LONG_RUN],
  workouts: ['Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint'],
  races: ['Race'],
} as const satisfies Record<Exclude<FilterGroup, 'all'>, readonly FilterKind[]>

export const GROUP_IDS = ['all', 'easy', 'workouts', 'races'] as const satisfies readonly FilterGroup[]
export const SORT_IDS = ['newest', 'oldest', 'longest', 'fastest'] as const satisfies readonly ActivitySort[]

const SHEET_ORDER: readonly FilterKind[] = Object.values(FILTER_GROUPS).flat()

function isGroup(value: unknown): value is FilterGroup {
  return (GROUP_IDS as readonly unknown[]).includes(value)
}

/** From ?group=easy or ?types=Threshold,VO2Max; anything unknown is dropped. */
export function parseFilter(group: string | null, types: string | null): ActivityFilter {
  const picked = (types ?? '').split(',').filter(isFilterKind)
  if (picked.length > 0) return normalizeTypes(picked)
  return { group: isGroup(group) ? group : 'all', types: [] }
}

export function parseSort(value: string | null): ActivitySort {
  return (SORT_IDS as readonly (string | null)[]).includes(value) ? (value as ActivitySort) : 'newest'
}

export function normalizeTypes(types: readonly FilterKind[]): ActivityFilter {
  const picked = SHEET_ORDER.filter((type) => types.includes(type))
  if (picked.length === 0) return ALL_RUNS
  for (const group of GROUP_IDS) {
    if (group === 'all') continue
    const members: readonly FilterKind[] = FILTER_GROUPS[group]
    if (members.length === picked.length && members.every((type) => picked.includes(type))) return { group, types: [] }
  }
  return { group: 'all', types: picked }
}

/** Null for every run, an unknown type included. */
export function filterTypes(filter: ActivityFilter): readonly FilterKind[] | null {
  if (filter.types.length > 0) return filter.types
  return filter.group === 'all' ? null : FILTER_GROUPS[filter.group]
}

export function checkedTypes(filter: ActivityFilter): FilterKind[] {
  return [...(filterTypes(filter) ?? [])]
}

export function sortQuery(sort: ActivitySort): { sortBy: ActivitySortKey; sortOrder: ActivitySortOrder } {
  switch (sort) {
    case 'newest':
      return { sortBy: 'date', sortOrder: 'desc' }
    case 'oldest':
      return { sortBy: 'date', sortOrder: 'asc' }
    case 'longest':
      return { sortBy: 'distance', sortOrder: 'desc' }
    case 'fastest':
      return { sortBy: 'pace', sortOrder: 'asc' }
  }
}

export function countByType(items: readonly Pick<ActivitySummary, 'type' | 'durationSeconds' | 'description'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const a of items) {
    const kind = kindOfRun(a)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return counts
}

export function matchingCount(counts: ReadonlyMap<string, number>, types: readonly FilterKind[]): number {
  if (types.length === 0) return [...counts.values()].reduce((sum, n) => sum + n, 0)
  return types.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0)
}

export function kindLabel(kind: FilterKind): string {
  return kind === LONG_RUN ? t.activities.longRun : t.activityTypes[kind] ?? kind
}

export function typesLabel(types: readonly FilterKind[]): string {
  return types.map(kindLabel).join(', ')
}
