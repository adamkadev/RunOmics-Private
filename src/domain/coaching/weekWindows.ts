import { DAY_MS } from '@/lib/calendarDate'

export const MAX_BOOTSTRAP_WEEKS = 5

export interface WeekWindow {
  startDate: string
  endDate: string
}

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function sundayOnOrAfter(date: Date): Date {
  return new Date(date.getTime() + ((7 - date.getUTCDay()) % 7) * DAY_MS)
}

export function isoWeekWindows(planningStartDate: string, horizonEndDate: string): WeekWindow[] {
  const horizonEnd = utc(horizonEndDate)
  const windows: WeekWindow[] = []
  let start = utc(planningStartDate)

  while (start.getTime() <= horizonEnd.getTime()) {
    const sunday = sundayOnOrAfter(start)
    const end = sunday.getTime() < horizonEnd.getTime() ? sunday : horizonEnd
    windows.push({ startDate: iso(start), endDate: iso(end) })
    start = new Date(end.getTime() + DAY_MS)
  }

  return windows
}

export function weekWindowIndex(windows: WeekWindow[], startDate: string): number | null {
  const index = windows.findIndex((window) => window.startDate === startDate)
  return index === -1 ? null : index + 1
}
