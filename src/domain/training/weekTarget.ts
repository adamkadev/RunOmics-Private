import type { ActivityType } from '@/domain/activity/types'
import { monthDays, type MonthDay } from './monthDays'

/**
 * Two numbers exist, and they are named apart:
 * - the plan: the km and sessions the coach or Garmin scheduled this week;
 * - the volume goal: the weekly share of the annual distance goal.
 * What was run is measured against each of them, never blended into either.
 */

export interface WeekTargetDay {
  date: string
  ranKm: number
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

/** Done: run, or its session run a day either side. Missed: over, nothing stood for it. Planned: still to come. */
export type WeekDayState = 'done' | 'planned' | 'missed' | 'rest'

export type WeekTargetDayState = WeekTargetDay & { state: WeekDayState } & Pick<MonthDay, 'ranOn' | 'standsFor'>

export interface WeekTarget {
  ranKm: number
  ranSessions: number
  /** The plan's total, missed sessions included; null when nothing is planned or no session gives a distance. */
  planKm: number | null
  planSessions: number
  /** Planned sessions that were run on their day or a day either side; unplanned runs never count here. */
  plannedDone: number
  /** Runs on a day the plan left empty that stand for no session. */
  unplannedRuns: number
  missedSessions: number
  /** The annual goal's weekly share; null when there is no annual goal. */
  goalKm: number | null
  days: WeekTargetDayState[]
}

/** In the Month view's states, `edges` the days either side, so a session run a day early or late is done everywhere. */
export function weekTarget(days: WeekTargetDay[], today: string, goalKm: number | null, edges: readonly WeekTargetDay[] = []): WeekTarget {
  const planned = days.filter((d) => d.plannedSessions > 0)
  const byDate = new Map([...edges, ...days].map((d) => [d.date, d]))
  const month = monthDays(
    days.map((d) => d.date),
    (date) => (byDate.get(date)?.runs ?? 0) > 0,
    (date) => (byDate.get(date)?.plannedSessions ?? 0) > 0,
    today,
  )
  const states = days.map((d): WeekTargetDayState => {
    const { state, ranOn, standsFor } = month.get(d.date) ?? { state: 'rest' }
    return { ...d, state: state === 'extra' ? 'done' : state, ...(ranOn ? { ranOn } : {}), ...(standsFor ? { standsFor } : {}) }
  })

  return {
    ranKm: round1(days.reduce((sum, d) => sum + d.ranKm, 0)),
    ranSessions: days.reduce((sum, d) => sum + d.runs, 0),
    planKm: planned.some((d) => d.plannedKm !== null) ? round1(planned.reduce((sum, d) => sum + (d.plannedKm ?? 0), 0)) : null,
    planSessions: planned.reduce((sum, d) => sum + d.plannedSessions, 0),
    plannedDone: states.reduce((sum, d) => sum + (d.plannedSessions === 0 ? 0 : d.ranOn ? 1 : Math.min(d.runs, d.plannedSessions)), 0),
    unplannedRuns: states.filter((d) => d.plannedSessions === 0).reduce((sum, d) => sum + d.runs - (d.standsFor ? 1 : 0), 0),
    missedSessions: states.filter((d) => d.state === 'missed').reduce((sum, d) => sum + d.plannedSessions, 0),
    goalKm: goalKm !== null && goalKm > 0 ? goalKm : null,
    days: states,
  }
}

function round1(km: number): number {
  return Math.round(km * 10) / 10
}

/** One target per week: the goal share stands in only when nothing is planned. */
export function weeklyTargetKm(target: Pick<WeekTarget, 'planKm' | 'goalKm'>): number | null {
  return target.planKm ?? target.goalKm
}
