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

export function weeksInPlan(span: PlanSpan | null, today: string): { done: number; total: number } | null {
  if (!span) return null

  const first = mondayOf(span.startDate)
  const last = mondayOf(span.endDate)
  const current = mondayOf(today)

  const total = Math.max(1, weeksBetween(first, last) + 1)
  const done = Math.min(total, Math.max(1, weeksBetween(first, current) + 1))
  return { done, total }
}
