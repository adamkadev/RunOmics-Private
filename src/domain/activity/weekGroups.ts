import { isoDate, startOfWeek } from '@/lib/calendarDate'

/** The week's Monday, as an ISO date. */
export function weekStartOf(date: string): string {
  return isoDate(startOfWeek(new Date(date + 'T00:00:00')))
}

export interface WeekGroup<T> {
  /** The Monday the week starts on, as an ISO date. */
  key: string
  items: T[]
  totalKm: number
  /** The calendar week that contains today, not whichever week the list shows first. */
  isCurrent: boolean
}

/** In the caller's order: the archive reads newest- or oldest-first, and grouping must not decide that. */
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
