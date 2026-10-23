import { DAY_MS, addDays, isoDate } from '@/lib/calendarDate'
import type { TrainingStatusType } from '@/domain/training/status'

export interface TrainingStatusSegment {
  status: TrainingStatusType
  days: number
  from: string
  to: string
}

export function buildSegments(
  points: Array<{ date: string; status: TrainingStatusType | null }>,
): TrainingStatusSegment[] {
  const segments: TrainingStatusSegment[] = []

  for (const point of points) {
    const status = point.status
    if (!status) continue

    const last = segments[segments.length - 1]
    if (last && last.status === status && isNextDay(last.to, point.date)) {
      last.days += 1
      last.to = point.date
      continue
    }
    segments.push({ status, days: 1, from: point.date, to: point.date })
  }

  return segments
}

function isNextDay(previous: string, current: string): boolean {
  const gap = new Date(current + 'T00:00:00').getTime() - new Date(previous + 'T00:00:00').getTime()
  return gap === DAY_MS
}

/**
 * Calendar days, not the last N records, which can span months when the watch
 * skips days. Today and Analytics both count from this.
 */
export function trainingStatusDays<S extends string>(
  points: ReadonlyArray<{ date: string; status: S | null }>,
  endIso: string,
  windowDays: number,
): { date: string; status: S | null }[] {
  const byDate = new Map(points.map((p) => [p.date.slice(0, 10), p.status]))
  const end = new Date(endIso + 'T00:00:00')
  return Array.from({ length: windowDays }, (_, i) => {
    const date = isoDate(addDays(end, i - windowDays + 1))
    return { date, status: byDate.get(date) ?? null }
  })
}
