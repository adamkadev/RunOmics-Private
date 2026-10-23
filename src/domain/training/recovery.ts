import { DAY_MS } from '@/lib/calendarDate'

/** One night: Garmin's overnight HRV average (ms) and the day's resting HR (bpm). */
export interface RecoveryNight {
  date: string
  hrv: number | null
  restingHr: number | null
}

/** A run day's resting HR counts where the watch was worn on two run-free days within a week of it. */
const WORN_NEAR_DAYS = 7
const WORN_RUN_FREE_DAYS = 2

const dayNumber = (date: string): number => Math.round(Date.parse(date) / DAY_MS)

/**
 * Garmin's daily resting HR is the lowest 30 minutes of the hours the watch was
 * worn, so it is a rest's only where the watch was on for more than a run: a
 * night with an HRV reading, a day without a run, or a run day with two such
 * days within a week of it (a watch worn all day but not to sleep). Any other
 * run day is a watch put on to run, and its value is a warm-up's.
 */
export function restingNights(nights: readonly RecoveryNight[], runDays: ReadonlySet<string>): RecoveryNight[] {
  const runFree = nights.filter((n) => n.restingHr !== null && !runDays.has(n.date)).map((n) => dayNumber(n.date))
  const wornAllDay = (date: string) =>
    runFree.filter((d) => Math.abs(d - dayNumber(date)) <= WORN_NEAR_DAYS).length >= WORN_RUN_FREE_DAYS
  return nights
    .map((n) =>
      n.restingHr !== null && n.hrv === null && runDays.has(n.date) && !wornAllDay(n.date) ? { ...n, restingHr: null } : n,
    )
    .filter((n) => n.hrv !== null || n.restingHr !== null)
}
