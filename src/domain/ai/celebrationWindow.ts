import { DAY_MS } from '@/lib/calendarDate'

/**
 * Kept out of `pbCelebrationInsight` so the dashboard's client bundle does not
 * follow that module's import of `insightHash` into Node's `crypto`.
 */
const CELEBRATION_WINDOW_DAYS = 3

export function isRecentRecord(date: string, now: Date): boolean {
  const days = (now.getTime() - new Date(`${date}T00:00:00`).getTime()) / DAY_MS
  return days >= 0 && days <= CELEBRATION_WINDOW_DAYS
}
