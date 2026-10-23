import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView, type HeroWorkoutView, type PlanWorkoutView } from '@/components/plan/planWorkoutView'
import { paceLabel, workoutSummary } from '@/components/plan/workoutSummary'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDurationWords, formatPlannedKm, formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'
import { kindOfType, type SessionKind } from './sessionKind'

/** The next session on the plan after today, as the hero's rest row names it. */
export interface NextSession {
  date: string
  /** Its name for a line of prose: the coach's short name where there is one. */
  title: string
  /** Whole planned km ("10"), or null when the plan gives no distance. */
  km: string | null
  /** Days after today: 1 is tomorrow. */
  inDays: number
  /** The session's kind, the coach's own type over the plan's, for the verdict's words. */
  kind: SessionKind | null
  /** The session itself, for the hero's tile: its line and its structure bar. */
  workout?: HeroWorkoutView
}

/**
 * The plan's session on a day, in Plan's priority: the coach's over Garmin's,
 * a cancelled one none. Today's, as Today shows it, is `sessionOn(today, …)`.
 */
export function sessionOn(
  date: string,
  coach: readonly Parameters<typeof coachWorkoutView>[0][],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null,
): { workout: PlanWorkoutView; kind: SessionKind | null } | null {
  const view = coach.find((v) => v.prescription.date === date && v.state !== 'cancelled')
  const plan = garmin.find((p) => p.date === date) ?? null
  const workout = view ? coachWorkoutView(view, zones, plan) : plan ? plannedWorkoutView(plan, zones) : null
  if (!workout) return null
  return { workout, kind: view ? view.prescription.type : plan?.type ? kindOfType(plan.type) : null }
}

/** A week ahead: past that, "next" is no longer what today's rest is for. */
const HORIZON_DAYS = 7

/**
 * The first day after today with a session on it, in Plan's priority - the
 * coach's prescription over Garmin's, a cancelled one is no session - and in
 * Plan's words (workoutSummary), so the two screens name it alike.
 */
export function findNextSession(
  today: string,
  coach: readonly Parameters<typeof coachWorkoutView>[0][],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null = null,
): NextSession | null {
  const start = new Date(`${today}T00:00:00`)
  for (let i = 1; i <= HORIZON_DAYS; i++) {
    const date = isoDate(addDays(start, i))
    const session = sessionOn(date, coach, garmin, zones)
    if (!session) continue
    const { workout, kind } = session
    return {
      date,
      title: workoutSummary(workout).shortTitle,
      km: workout.distanceM ? formatPlannedKm(workout.distanceM / 1000) : null,
      inDays: i,
      kind,
      workout: heroWorkoutView(workout),
    }
  }
  return null
}

/** Plan's week on a day, with that day selected: PlanClient reads the date from the URL. */
export function planDayHref(date: string): string {
  return `/plan?date=${date}`
}

/** The next-workout card: the session, when it is, and the phase it falls in. */
export interface SessionCard {
  date: string
  /** "Tomorrow · Tue 20", "Today · Mon 19", or the day alone further out. */
  eyebrow: string
  /** The session's short name: the card's title is 26 pt. */
  title: string
  /** Its planned km ("10"), the detail line's lead; null when the plan gives none. */
  km: string | null
  /** What follows the km: "1:00 h · ≤ 158 bpm". */
  detail: string | null
  /** The session, for its intensity bar; null when only its name is known. */
  workout: HeroWorkoutView | null
  /** The phase of the plan the day falls in ("Base"), or null outside one. */
  phase: string | null
  href: string
}

/**
 * The session the card shows (design review 3.0, mock 1b): today's until it
 * is run, then the next one in the week ahead; none in a week with nothing
 * left. Its length, then its heart-rate ceiling where the session has one,
 * else its one pace.
 */
export function sessionCard(
  today: string,
  todayWorkout: HeroWorkoutView | null,
  todayActivity: ActivitySummary | null,
  next: NextSession | null,
  {
    phaseOn = () => null,
    hrCapOf = () => null,
  }: { phaseOn?: (date: string) => string | null; hrCapOf?: (workout: HeroWorkoutView | null) => number | null } = {},
): SessionCard | null {
  const s = t.dashboard.todayHero
  const pick =
    todayWorkout && !todayActivity
      ? { date: today, workout: todayWorkout, title: null }
      : next
        ? { date: next.date, workout: next.workout ?? null, title: next.title }
        : null
  if (!pick) return null

  const { date, workout } = pick
  const summary = workout ? workoutSummary({ ...workout, structure: workout.structure ?? null }) : null
  const tomorrow = isoDate(addDays(new Date(`${today}T00:00:00`), 1))
  const when = date === today ? s.today : date === tomorrow ? s.tomorrow : null
  const day = formatWeekday(date, true)
  const hrCap = hrCapOf(workout)
  // A ceiling says how to run it; without one, a single pace does. A session
  // with several paces is Plan's to list.
  const limit = hrCap ? `${s.hrCap(hrCap)} ${t.units.bpm}` : summary?.paces.length === 1 ? paceLabel(summary.paces[0]!) : null
  return {
    date,
    eyebrow: when ? `${when} · ${day}` : day,
    title: summary?.shortTitle ?? pick.title ?? '',
    km: workout?.distanceM ? formatPlannedKm(workout.distanceM / 1000) : null,
    detail: [workout?.duration ? formatDurationWords(workout.duration.seconds) : null, limit].filter(Boolean).join(' · ') || null,
    workout,
    phase: phaseOn(date),
    href: planDayHref(date),
  }
}
