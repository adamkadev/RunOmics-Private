import { isActivityType, type ActivitySummary, type ActivityType } from '@/domain/activity/types'
import { isLongSession } from '@/domain/activity/longRun'
import type { ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import { t } from '@/i18n'

/**
 * The long run as a filter of its own (App Fixes 3d). It is not a type the
 * classifier gives - a long run is a Base run - so it is a kind the filter
 * derives: Base runs the long-run rule picks out, with the rest of Base
 * left as plain easy running.
 */
export const LONG_RUN = 'LongRun'
export type FilterKind = ActivityType | typeof LONG_RUN

export function isFilterKind(value: unknown): value is FilterKind {
  return value === LONG_RUN || isActivityType(value)
}

/** Which kind a run counts as: its type, or the long run it was. */
export function kindOfRun(activity: Pick<ActivitySummary, 'type' | 'durationSeconds' | 'description'>): FilterKind {
  return activity.type === 'Base' && isLongSession(activity) ? LONG_RUN : activity.type
}

export type FilterGroup = 'all' | 'easy' | 'workouts' | 'races'
export type ActivitySort = 'newest' | 'oldest' | 'longest' | 'fastest'

/**
 * What the list shows (3.0): a group chip, or the exact types picked in the
 * filter sheet. Picked types win over the group, which is 'all' beside them.
 */
export interface ActivityFilter {
  group: FilterGroup
  types: FilterKind[]
}

export const ALL_RUNS: ActivityFilter = { group: 'all', types: [] }

/**
 * The chips' groups over the seven real types. The design's Recovery and
 * Long are not types the classifier gives - a recovery or long run is Base -
 * so Easy is Base alone.
 */
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

/** The filter as the URL keeps it: ?group=easy, or ?types=Threshold,VO2Max. Anything unknown is dropped. */
export function parseFilter(group: string | null, types: string | null): ActivityFilter {
  const picked = (types ?? '').split(',').filter(isFilterKind)
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

/** The kinds a filter lets through, or null for every run (an unknown type included). */
export function filterTypes(filter: ActivityFilter): readonly FilterKind[] | null {
  if (filter.types.length > 0) return filter.types
  return filter.group === 'all' ? null : FILTER_GROUPS[filter.group]
}

/** The sheet's ticks for a filter: a group chip opens with its types ticked. */
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

/** Runs per kind across the archive, for the sheet's counts. */
export function countByType(items: readonly Pick<ActivitySummary, 'type' | 'durationSeconds' | 'description'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const a of items) {
    const kind = kindOfRun(a)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return counts
}

/** How many runs the sheet's ticks would show: its "Show 30 runs". */
export function matchingCount(counts: ReadonlyMap<string, number>, types: readonly FilterKind[]): number {
  if (types.length === 0) return [...counts.values()].reduce((sum, n) => sum + n, 0)
  return types.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0)
}

/** What a kind is called: a type's own name, or "Long run". */
export function kindLabel(kind: FilterKind): string {
  return kind === LONG_RUN ? t.activities.longRun : t.activityTypes[kind] ?? kind
}

/** The one chip that stands for picked types: "Threshold, VO₂ Max". */
export function typesLabel(types: readonly FilterKind[]): string {
  return types.map(kindLabel).join(', ')
}
