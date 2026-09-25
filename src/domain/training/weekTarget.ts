import type { ActivityType } from '@/domain/activity/types'

/**
 * One answer to "am I on track this week", for every screen that asks it.
 *
 * Today's ring, the Activities "This week" card and Plan's week summary used to
 * each count the week their own way: Today read the annual goal's weekly share
 * as "of 23 km", Activities called that same number "23 km planned", and Plan
 * added what was run to what was still planned (missed days included) and
 * called the sum the week's volume. Three screens, three targets, and the word
 * "planned" meaning two things.
 *
 * Two numbers exist, and they are named apart:
 * - the plan: the km and sessions the coach or Garmin scheduled this week;
 * - the volume goal: the weekly share of the annual distance goal.
 * What was run is measured against each of them, never blended into either.
 */

/** A day of the week as the plan and the watch saw it. */
export interface WeekTargetDay {
  date: string
  /** Kilometres recorded that day, over every run. */
  ranKm: number
  /** Runs recorded that day. */
  runs: number
  /** Kilometres the plan scheduled that day, when it said. */
  plannedKm: number | null
  /** Sessions the plan scheduled that day; 0 is a day with nothing planned. */
  plannedSessions: number
  /**
   * The day's intensity: what was run when it was run (the hardest run), what
   * was planned otherwise.
   */
  type?: ActivityType
  /** Set only when the day was run as something other than what was planned. */
  plannedType?: ActivityType
}

/**
 * Done: something was run. Missed: the plan had a session on a day that is
 * over and nothing was run. Planned: a session is still to come (today
 * included). Rest: nothing planned, nothing run.
 */
export type WeekDayState = 'done' | 'planned' | 'missed' | 'rest'

export interface WeekTarget {
  ranKm: number
  ranSessions: number
  /** The plan's total, missed sessions included; null when nothing is planned. */
  planKm: number | null
  planSessions: number
  missedSessions: number
  /** The annual goal's weekly share; null when there is no annual goal. */
  goalKm: number | null
  days: (WeekTargetDay & { state: WeekDayState })[]
}

export function weekDayState(day: WeekTargetDay, today: string): WeekDayState {
  if (day.runs > 0) return 'done'
  if (day.plannedSessions === 0) return 'rest'
  return day.date < today ? 'missed' : 'planned'
}

export function weekTarget(days: WeekTargetDay[], today: string, goalKm: number | null): WeekTarget {
  const planned = days.filter((d) => d.plannedSessions > 0)
  const states = days.map((d) => ({ ...d, state: weekDayState(d, today) }))

  return {
    ranKm: round1(days.reduce((sum, d) => sum + d.ranKm, 0)),
    ranSessions: days.reduce((sum, d) => sum + d.runs, 0),
    planKm: planned.length > 0 ? round1(planned.reduce((sum, d) => sum + (d.plannedKm ?? 0), 0)) : null,
    planSessions: planned.reduce((sum, d) => sum + d.plannedSessions, 0),
    missedSessions: days
      .filter((d, i) => states[i]!.state === 'missed')
      .reduce((sum, d) => sum + d.plannedSessions, 0),
    goalKm: goalKm !== null && goalKm > 0 ? goalKm : null,
    days: states,
  }
}

function round1(km: number): number {
  return Math.round(km * 10) / 10
}
