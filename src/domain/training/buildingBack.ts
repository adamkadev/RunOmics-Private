import { DAY_MS } from '@/lib/calendarDate'

/** A gap this long leaves no chronic load behind: what follows is a new base, not a dip in the old one. */
export const LONG_BREAK_DAYS = 28

/** Running this long after a break before the load estimate is read again. */
export const REBUILD_DAYS = 28

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

/** The first run after the athlete's most recent break of LONG_BREAK_DAYS or more. */
export function firstRunBack(runDates: readonly string[]): string | null {
  const days = [...new Set(runDates)].sort()
  for (let i = days.length - 1; i > 0; i--) {
    if (daysBetween(days[i - 1]!, days[i]!) >= LONG_BREAK_DAYS) return days[i]!
  }
  return null
}

/**
 * True while fewer than REBUILD_DAYS of running have followed a long break.
 * Fitness, fatigue and the acute/chronic ratio are all read against a chronic
 * load the break erased, so they say "overreaching" about the gap, not about
 * the athlete.
 */
export function buildingBack(runDates: readonly string[], today: string): boolean {
  const back = firstRunBack(runDates)
  return back !== null && back <= today && daysBetween(back, today) < REBUILD_DAYS
}
