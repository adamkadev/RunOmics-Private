import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { HeatAhead } from '@/application/usecases/GetHeatAhead'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView, type HeroWorkoutView, type PlanWorkoutView } from '@/components/plan/planWorkoutView'
import { paceLabel, workoutSummary } from '@/components/plan/workoutSummary'
import { isRunWalkPlan } from '@/domain/activity/runWalk'
import { sessionLabel } from '@/lib/activityTitle'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDurationWords, formatPlannedKm, formatWeekday, formatWeekdayLong } from '@/lib/formatters'
import { t } from '@/i18n'
import { kindOfType, type SessionKind } from './sessionKind'

export interface NextSession {
  date: string
  /** Its name for a line of prose: the coach's short name where there is one. */
  title: string
  /** Whole planned km ("10"), or null when the plan gives no distance. */
  km: string | null
  /** Days after today: 1 is tomorrow. */
  inDays: number
  /** The coach's own type over the plan's. */
  kind: SessionKind | null
  workout?: HeroWorkoutView
}

/** In Plan's priority: the coach's over Garmin's, a cancelled one none. */
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

/** In Plan's words (workoutSummary), so the two screens name it alike. */
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

/** PlanClient reads the selected day from the URL. */
export function planDayHref(date: string): string {
  return `/plan?date=${date}`
}

export interface SessionCard {
  date: string
  /** "Tomorrow · Sat 14", or the day alone further out; null on today's own session, which the page title names. */
  eyebrow: string | null
  /** The session's short name, at display size only on today's run. */
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
  /** Today's session only, when the forecast at the usual running hour falls in a band that slows the athlete. */
  heat?: HeatAhead | null
  /** A rest day's line ("No run today. Threshold tomorrow."): the card leads with the rest, the session below it. */
  rest?: string | null
}

/** Garmin and the coach call a run/walk an easy run ("Footing 4 × 6′"); its set keeps the run/walk name. */
export function runWalkName(title: string, workout: HeroWorkoutView | null): string {
  if (!workout?.structure) return title
  if (!isRunWalkPlan({ date: '', name: workout.title, type: workout.type, steps: workout.structure })) return title
  const set = sessionLabel(title)
  return set === title ? title : `${t.dashboard.todayHero.runWalk} ${set}`
}

function restLine(date: string, tomorrow: boolean, kind: SessionKind | null, runWalk: boolean): string {
  const s = t.dashboard.todayHero
  const name = runWalk ? s.runWalk : kind ? t.dashboard.weeklyStreak.kinds[kind] : s.aRun
  return s.restLine(name, tomorrow ? s.restTomorrow : s.restOn(formatWeekdayLong(date)))
}

/**
 * The session's name as Plan shows it, "4 × 5′ @ 4:31", and the type a set leaves out, for the eyebrow; "Easy run +
 * 6 strides" and "Long run" already start with theirs.
 */
export function titleParts(summary: { title: string; shortTitle: string }): { title: string; type: string | null } {
  const label = sessionLabel(summary.title)
  if (!/^\d/.test(label)) return { title: label, type: null }
  return { title: label, type: /^(\p{L}[^\d]*?)\s*(?=\d)/u.exec(summary.shortTitle)?.[1]?.trim() ?? null }
}

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
      ? { date: today, workout: todayWorkout, title: null, kind: null }
      : next
        ? { date: next.date, workout: next.workout ?? null, title: next.title, kind: next.kind }
        : null
  if (!pick) return null

  const { date, workout } = pick
  const summary = workout ? workoutSummary({ ...workout, structure: workout.structure ?? null }) : null
  const tomorrow = isoDate(addDays(new Date(`${today}T00:00:00`), 1))
  const when = date === tomorrow ? s.tomorrow : null
  const day = formatWeekday(date, true)
  const hrCap = hrCapOf(workout)
  // A ceiling says how to run it; without one, a single pace does; several paces are Plan's to list.
  const limit = hrCap ? `${s.hrCap(hrCap)} ${t.units.bpm}` : summary?.paces.length === 1 ? paceLabel(summary.paces[0]!) : null
  const { title, type } = summary ? titleParts(summary) : { title: pick.title ?? '', type: null }
  const full = type ? `${type} ${title}` : title
  const named = runWalkName(full, workout)
  // The type in the eyebrow keeps a set's title on one line, as on Plan; a run/walk keeps its own name.
  const set = type && named === full ? type : null
  const name = set ? title : named
  const eyebrow = date === today ? (set ? `${day} · ${set}` : null) : [when, day, set].filter(Boolean).join(' · ')
  return {
    date,
    eyebrow,
    title: name,
    km: workout?.distanceM ? formatPlannedKm(workout.distanceM / 1000) : null,
    detail: [workout?.duration ? formatDurationWords(workout.duration.seconds) : null, limit].filter(Boolean).join(' · ') || null,
    workout,
    phase: phaseOn(date),
    href: planDayHref(date),
    rest: !todayWorkout && !todayActivity ? restLine(date, date === tomorrow, pick.kind, named !== full) : null,
  }
}
