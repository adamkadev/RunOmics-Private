import { DAY_MS } from '@/lib/calendarDate'
import type { PlanCoachingView } from './planCoachingView'

export interface BlockLifecycle {
  startDate: string
  endDate: string
  /** Days from today to the block's last day; negative once the block is over. */
  daysLeft: number
  done: number
  total: number
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

export function blockLifecycle(coaching: PlanCoachingView | null, today: string): BlockLifecycle | null {
  if (!coaching) return null
  const { startDate, endDate } = coaching.plan.block
  const planned = coaching.workouts.filter((view) => view.state !== 'cancelled')
  return {
    startDate,
    endDate,
    daysLeft: daysBetween(today, endDate),
    done: planned.filter((view) => view.state === 'completed').length,
    total: planned.length,
  }
}

/** A day the coach wrote a week for: outside it nothing is planned, which is not the same as a rest day. */
export function blockCovers(block: BlockLifecycle | null, date: string): boolean {
  return block === null || (date >= block.startDate && date <= block.endDate)
}

/** The last date anything is planned for, from the coach's block or the watch's calendar. */
export function lastPlannedDate(coaching: PlanCoachingView | null, plannedDates: readonly string[]): string | null {
  const dates = [...plannedDates, ...(coaching ? [coaching.plan.block.endDate] : [])]
  return dates.length ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null
}
