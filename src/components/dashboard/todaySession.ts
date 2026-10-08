import type { ActivitySummary } from '@/domain/activity/types'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { paceLabel, workoutSummary } from '@/components/plan/workoutSummary'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import type { NextSession } from './nextSession'
import { formatDistance, formatPace, formatPlannedKm, formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'

export interface TodaySession {
  state: WeekDayState
  title: string
  detail: string | null
  href?: string
}

function plannedKm(workout: HeroWorkoutView | null): string | null {
  return workout?.distanceM ? formatPlannedKm(workout.distanceM / 1000) : null
}

/** A run against its plan: "Ran 10.0 km at 5:59 /km · planned 9 km". */
export function ranDetail(activity: ActivitySummary, workout: HeroWorkoutView | null): string {
  const ran = activity.paceSecPerKm !== null
    ? t.sessionCard.ranAt(formatDistance(activity.distanceKm), formatPace(activity.paceSecPerKm))
    : t.sessionCard.ran(formatDistance(activity.distanceKm))
  const planned = plannedKm(workout)
  return [ran, planned ? t.sessionCard.plannedKm(planned) : null].filter(Boolean).join(' · ')
}

/**
 * A planned session's line, as Plan's card has it (v4.3 A1): each pace by
 * name, "10 km · easy 5:30–6:24 · strides 3:35".
 */
export function plannedDetail(workout: HeroWorkoutView): string | null {
  const summary = workoutSummary({ ...workout, structure: workout.structure ?? null })
  const planned = plannedKm(workout)
  return [planned ? `${planned} ${t.units.km}` : null, ...(summary.paces.length > 0 ? summary.paces.map(paceLabel) : [workout.target])]
    .filter(Boolean)
    .join(' · ') || null
}

/**
 * Today's session and its state, as the hero's SessionCard row says it: what
 * it is, whether it is done, and planned against what was run. The old footer
 * listed a completed run's "6.11 km · 25 min" with no state, so at 7 am it
 * read like the prescription it had replaced.
 */
export function todaySession(
  workout: HeroWorkoutView | null,
  activity: ActivitySummary | null,
  next: NextSession | null = null,
): TodaySession {
  const s = t.dashboard.todayHero
  // The same reading of the session as Plan's card and the structure bar
  // (workoutSummary), so the two screens cannot describe it differently.
  const summary = workout ? workoutSummary({ ...workout, structure: workout.structure ?? null }) : null
  const workoutTitle = summary?.title ?? null

  if (activity) {
    return {
      state: 'done',
      title: workoutTitle ?? (activity.description || t.activityTypes[activity.type]),
      detail: ranDetail(activity, workout),
      href: `/activities/${workout?.activityId ?? activity.id}`,
    }
  }

  if (workout && summary) {
    return {
      state: 'planned',
      title: workoutTitle!,
      detail: plannedDetail(workout),
      // The session is on the plan, so the row goes to the plan.
      href: '/plan',
    }
  }

  // A rest day says what comes after it (v4.17), as Plan's rest card does.
  return {
    state: 'rest',
    title: s.restDay,
    detail: next ? s.next(formatWeekday(next.date), next.title, next.km) : s.restDaySubtitle,
  }
}
