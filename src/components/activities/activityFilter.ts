import { isActivityType, type ActivitySummary, type ActivityType } from '@/domain/activity/types'
import type { ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import { t } from '@/i18n'

export type FilterGroup = 'all' | 'easy' | 'workouts' | 'races'
export type ActivitySort = 'newest' | 'longest' | 'fastest'

/**
 * What the list shows (3.0): a group chip, or the exact types picked in the
 * filter sheet. Picked types win over the group, which is 'all' beside them.
 */
export interface ActivityFilter {
  group: FilterGroup
  types: ActivityType[]
}

export const ALL_RUNS: ActivityFilter = { group: 'all', types: [] }

/**
 * The chips' groups over the seven real types. The design's Recovery and
 * Long are not types the classifier gives - a recovery or long run is Base -
 * so Easy is Base alone.
 */
export const FILTER_GROUPS = {
  easy: ['Base'],
  workouts: ['Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint'],
  races: ['Race'],
} as const satisfies Record<Exclude<FilterGroup, 'all'>, readonly ActivityType[]>

export const GROUP_IDS = ['all', 'easy', 'workouts', 'races'] as const satisfies readonly FilterGroup[]
export const SORT_IDS = ['newest', 'longest', 'fastest'] as const satisfies readonly ActivitySort[]

const SHEET_ORDER: readonly ActivityType[] = Object.values(FILTER_GROUPS).flat()

function isGroup(value: unknown): value is FilterGroup {
  return (GROUP_IDS as readonly unknown[]).includes(value)
}

/** The filter as the URL keeps it: ?group=easy, or ?types=Threshold,VO2Max. Anything unknown is dropped. */
export function parseFilter(group: string | null, types: string | null): ActivityFilter {
  const picked = (types ?? '').split(',').filter(isActivityType)
  if (picked.length > 0) return normalizeTypes(picked)
  return { group: isGroup(group) ? group : 'all', types: [] }
}

export function parseSort(value: string | null): ActivitySort {
  return (SORT_IDS as readonly (string | null)[]).includes(value) ? (value as ActivitySort) : 'newest'
}

/**
 * Types picked in the sheet, as the filter they amount to: none is every run,
 * exactly a group's types is that group's chip, anything else is the types
 * themselves, in the sheet's order.
 */
export function normalizeTypes(types: readonly ActivityType[]): ActivityFilter {
  const picked = SHEET_ORDER.filter((type) => types.includes(type))
  if (picked.length === 0) return ALL_RUNS
  for (const group of GROUP_IDS) {
    if (group === 'all') continue
    const members: readonly ActivityType[] = FILTER_GROUPS[group]
    if (members.length === picked.length && members.every((type) => picked.includes(type))) return { group, types: [] }
  }
  return { group: 'all', types: picked }
}

/** The types a filter lets through, or null for every run (an unknown type included). */
export function filterTypes(filter: ActivityFilter): readonly ActivityType[] | null {
  if (filter.types.length > 0) return filter.types
  return filter.group === 'all' ? null : FILTER_GROUPS[filter.group]
}

/** The sheet's ticks for a filter: a group chip opens with its types ticked. */
export function checkedTypes(filter: ActivityFilter): ActivityType[] {
  return [...(filterTypes(filter) ?? [])]
}

export function sortQuery(sort: ActivitySort): { sortBy: ActivitySortKey; sortOrder: ActivitySortOrder } {
  switch (sort) {
    case 'newest':
      return { sortBy: 'date', sortOrder: 'desc' }
    case 'longest':
      return { sortBy: 'distance', sortOrder: 'desc' }
    case 'fastest':
      return { sortBy: 'pace', sortOrder: 'asc' }
  }
}

/** Runs per type across the archive, for the sheet's counts. */
export function countByType(items: readonly Pick<ActivitySummary, 'type'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const a of items) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  return counts
}

/** How many runs the sheet's ticks would show: its "Show 30 runs". */
export function matchingCount(counts: ReadonlyMap<string, number>, types: readonly ActivityType[]): number {
  if (types.length === 0) return [...counts.values()].reduce((sum, n) => sum + n, 0)
  return types.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0)
}

/** The one chip that stands for picked types: "Threshold, VO₂ Max". */
export function typesLabel(types: readonly ActivityType[]): string {
  return types.map((type) => t.activityTypes[type] ?? type).join(', ')
}
