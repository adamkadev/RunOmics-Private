import { DAY_MS } from '@/lib/calendarDate'

/** One day's resting heart rate from the watch, bpm. */
export interface RecoveryDay {
  date: string
  restingHr: number
}

/** A run day's resting HR counts where the watch was worn on two run-free days within a week of it. */
const WORN_NEAR_DAYS = 7
const WORN_RUN_FREE_DAYS = 2

const dayNumber = (date: string): number => Math.round(Date.parse(date) / DAY_MS)

/**
 * The days whose resting HR is a resting one (round 2). Garmin's daily
 * resting HR is the lowest 30 minutes of the hours the watch was worn, so it
 * is a rest's only where the watch was on for more than a run:
 * - a day without a run: the watch was worn, and not to run;
 * - a run day with two such days within a week of it: a watch worn all day
 *   but not to sleep (the second athlete's, 59 to 70), the run one part of
 *   the day.
 * Any other run day is a watch put on to run (the owner's, a Fitbit at
 * night), and its value is a warm-up's: 50 to 60 against a true 45, 142 on a
 * hard day.
 */
export function restingDays(days: readonly RecoveryDay[], runDays: ReadonlySet<string>): RecoveryDay[] {
  const runFree = days.filter((d) => !runDays.has(d.date)).map((d) => dayNumber(d.date))
  const wornAllDay = (date: string) =>
    runFree.filter((d) => Math.abs(d - dayNumber(date)) <= WORN_NEAR_DAYS).length >= WORN_RUN_FREE_DAYS
  return days.filter((d) => !runDays.has(d.date) || wornAllDay(d.date))
}
