/**
 * A month's days as the plan reads them (design review, Oct 2026): July read
 * six runs with no plan the same as six run to plan, and a missed session in
 * colour alone. Each day now has one state:
 *
 *   done     planned, and run - on the day, or within the match window
 *   extra    run on a day with nothing planned, standing in for no session
 *   missed   planned, the day is past, and no run matched it
 *   planned  planned, today or later
 *   rest     nothing planned and nothing run
 *
 * A day is never missed while it is today or still to come.
 */

/**
 * A run this many days either side of a planned session that had no run on
 * its own day counts as that session, so a Tuesday run moved to Wednesday is
 * one done session, not a missed one and an extra one. Proposal; tune here.
 */
export const PLAN_MATCH_WINDOW_DAYS = 1

export type MonthDayState = 'done' | 'extra' | 'missed' | 'planned' | 'rest'

export interface MonthDay {
  state: MonthDayState
  /** A planned day that was run on another day: the day it was run. */
  ranOn?: string
  /** A run on a day with nothing planned that stood in for a planned day: that day. */
  standsFor?: string
}

const DAY_MS = 86_400_000
const plusDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** The day before, then the day after, then two before... out to the window. */
function offsets(window: number): number[] {
  return Array.from({ length: window }, (_, i) => [-(i + 1), i + 1]).flat()
}

/**
 * Every date in `dates` (ISO, ascending, one month) with its state. Matching
 * looks past the month's edges, so a run on the 31st can stand for a session
 * planned on the 1st of the next month on both months' screens.
 */
export function monthDays(
  dates: readonly string[],
  ran: (date: string) => boolean,
  planned: (date: string) => boolean,
  today: string,
  window = PLAN_MATCH_WINDOW_DAYS,
): Map<string, MonthDay> {
  const first = dates[0]
  const last = dates.at(-1)
  const days = new Map<string, MonthDay>()
  if (!first || !last) return days

  // Sessions with no run on their own day, in date order, the window's edges included.
  const unrun: string[] = []
  for (let d = plusDays(first, -window); d <= plusDays(last, window); d = plusDays(d, 1)) {
    if (planned(d) && !ran(d)) unrun.push(d)
  }
  const ranOn = new Map<string, string>()
  const standsFor = new Map<string, string>()
  for (const day of unrun) {
    for (const offset of offsets(window)) {
      const other = plusDays(day, offset)
      // A run on a day with its own plan is that day's; a day still to come has no run.
      if (other > today || !ran(other) || planned(other) || standsFor.has(other)) continue
      ranOn.set(day, other)
      standsFor.set(other, day)
      break
    }
  }

  for (const date of dates) {
    const isPlanned = planned(date)
    const isRun = ran(date)
    if (isPlanned && isRun) days.set(date, { state: 'done' })
    else if (isPlanned && ranOn.has(date)) days.set(date, { state: 'done', ranOn: ranOn.get(date)! })
    else if (isPlanned) days.set(date, { state: date < today ? 'missed' : 'planned' })
    else if (isRun && standsFor.has(date)) days.set(date, { state: 'done', standsFor: standsFor.get(date)! })
    else if (isRun) days.set(date, { state: 'extra' })
    else days.set(date, { state: 'rest' })
  }
  return days
}
