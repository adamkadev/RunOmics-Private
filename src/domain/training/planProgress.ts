import { startOfWeek } from '@/lib/calendarDate'

export interface PlanSpan {
  startDate: string
  endDate: string
}

function mondayOf(date: string): Date {
  return startOfWeek(new Date(date + 'T00:00:00'))
}

function weeksBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (7 * 86_400_000))
}

/**
 * Where the athlete sits in their plan, counted the way Garmin Connect counts
 * it: in whole calendar weeks over the plan's *own* start-to-end span.
 *
 * Two things this deliberately does not do:
 *
 *   - it does not measure the phase ranges. Garmin only publishes phases from
 *     BUILD onward, so the base weeks that open a plan are absent from them -
 *     measuring the phases would silently drop those weeks and start the count
 *     weeks late;
 *   - it does not divide a day span by 7. A plan starting mid-week (this one
 *     opens on a Saturday) belongs to the week it falls in, so the count has to
 *     snap both ends to their Monday and count the weeks between them.
 *
 * Null when there is no dated plan - nothing here invents a block position.
 */
export function weeksInPlan(span: PlanSpan | null, today: string): { done: number; total: number } | null {
  if (!span) return null

  const first = mondayOf(span.startDate)
  const last = mondayOf(span.endDate)
  const current = mondayOf(today)

  const total = Math.max(1, weeksBetween(first, last) + 1)
  const done = Math.min(total, Math.max(1, weeksBetween(first, current) + 1))
  return { done, total }
}
