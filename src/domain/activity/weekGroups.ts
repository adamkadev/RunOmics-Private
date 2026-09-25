import { isoDate, startOfWeek } from '@/lib/calendarDate'

/** The Monday a date's week starts on, as an ISO date: the key a week groups under. */
export function weekStartOf(date: string): string {
  return isoDate(startOfWeek(new Date(date + 'T00:00:00')))
}

export interface WeekGroup<T> {
  /** The Monday the week starts on, as an ISO date. */
  key: string
  items: T[]
  totalKm: number
  /**
   * The calendar week that contains today. It used to mean "whichever week
   * the list happened to show first", so until a new week's first run last
   * week took the current card, and an oldest-first sort or a type filter
   * handed it to a week from months ago.
   */
  isCurrent: boolean
}

/**
 * Consecutive items of the same week, in the order the caller already sorted
 * them: the archive can be read newest- or oldest-first, and grouping must not
 * decide that for it.
 */
export function groupByWeek<T extends { date: string; distanceKm: number }>(
  items: readonly T[],
  currentWeekStart: string,
): WeekGroup<T>[] {
  const groups: WeekGroup<T>[] = []
  for (const item of items) {
    const key = weekStartOf(item.date)
    const open = groups[groups.length - 1]
    if (open && open.key === key) {
      open.items.push(item)
      open.totalKm += item.distanceKm
    } else {
      groups.push({ key, items: [item], totalKm: item.distanceKm, isCurrent: key === currentWeekStart })
    }
  }
  return groups
}

/**
 * A newest-first list opens on this week even before its first run. Without
 * a run there is no group for it, so the current week goes in empty, at the
 * place its date gives it, and its goal progress reads 0 km rather than the
 * previous week's total.
 */
export function withCurrentWeek<T>(groups: WeekGroup<T>[], currentWeekStart: string): WeekGroup<T>[] {
  if (groups.some((g) => g.isCurrent)) return groups
  const empty: WeekGroup<T> = { key: currentWeekStart, items: [], totalKm: 0, isCurrent: true }
  const olderAt = groups.findIndex((g) => g.key < currentWeekStart)
  return olderAt === -1 ? [...groups, empty] : [...groups.slice(0, olderAt), empty, ...groups.slice(olderAt)]
}
