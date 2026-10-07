import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView, type HeroWorkoutView, type PlanWorkoutView } from '@/components/plan/planWorkoutView'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatPlannedKm, formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'
import { ranDetail } from './todaySession'
import { kindOfType, type SessionKind } from './todayVerdict'

/** The next session on the plan after today, as the hero's rest row names it. */
export interface NextSession {
  date: string
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

/** The plan's session on a day, in Plan's priority: the coach's over Garmin's, a cancelled one none. */
function sessionOn(
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
      title: workoutSummary(workout).title,
      km: workout.distanceM ? formatPlannedKm(workout.distanceM / 1000) : null,
      inDays: i,
      kind,
      workout: heroWorkoutView(workout),
    }
  }
  return null
}

/** The row above the next session: a run done, or a session planned and not run. */
export interface LastRun {
  state: 'done' | 'missed'
  date: string
  title: string
  detail: string
  /** The run for a run; the plan, read-only, for a missed session. */
  href: string
}

/**
 * The hero's last-run row (design review, Oct 2026): today's run once it is
 * done; on a day with nothing left to run, yesterday's - the run, or the
 * session it planned and nobody ran. Before today's run there is none: the
 * tile under it is today's session. A missed session is said, never moved:
 * the plan is the coach's.
 */
export function findLastRun(
  today: string,
  todayActivity: ActivitySummary | null,
  todayWorkout: HeroWorkoutView | null,
  recent: readonly ActivitySummary[],
  coach: readonly Parameters<typeof coachWorkoutView>[0][],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null = null,
): LastRun | null {
  const s = t.dashboard.todayHero
  const title = (activity: ActivitySummary, workout: PlanWorkoutView | HeroWorkoutView | null) =>
    s.doneTitle(workout ? workoutSummary({ ...workout, structure: workout.structure ?? null }).title : activity.description || t.activityTypes[activity.type])
  if (todayActivity) {
    return { state: 'done', date: today, title: title(todayActivity, todayWorkout), detail: ranDetail(todayActivity, todayWorkout), href: `/activities/${todayActivity.id}` }
  }
  if (todayWorkout) return null

  const yesterday = isoDate(addDays(new Date(`${today}T00:00:00`), -1))
  const session = sessionOn(yesterday, coach, garmin, zones)
  const run = recent.find((a) => a.date === yesterday)
  if (run) {
    const workout = session ? heroWorkoutView(session.workout) : null
    return { state: 'done', date: yesterday, title: title(run, workout), detail: ranDetail(run, workout), href: `/activities/${run.id}` }
  }
  if (!session) return null
  const km = session.workout.distanceM ? formatPlannedKm(session.workout.distanceM / 1000) : null
  return {
    state: 'missed',
    date: yesterday,
    title: s.missedTitle(formatWeekday(yesterday), workoutSummary(session.workout).title),
    detail: s.notRun(km),
    href: '/plan',
  }
}
