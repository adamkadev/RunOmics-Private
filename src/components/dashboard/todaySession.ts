import type { ActivitySummary } from '@/domain/activity/types'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { workoutSummary } from '@/components/plan/workoutSummary'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { formatClock, formatDistance, formatPace, formatPlannedKm } from '@/lib/formatters'
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

/**
 * Today's session and its state, as the hero's SessionCard row says it: what
 * it is, whether it is done, and planned against what was run. The old footer
 * listed a completed run's "6.11 km · 25 min" with no state, so at 7 am it
 * read like the prescription it had replaced.
 */
export function todaySession(workout: HeroWorkoutView | null, activity: ActivitySummary | null): TodaySession {
  const s = t.dashboard.todayHero
  // The same reading of the session as Plan's card and the structure bar
  // (workoutSummary), so the two screens cannot describe it differently.
  const summary = workout ? workoutSummary({ ...workout, structure: workout.structure ?? null }) : null
  const workoutTitle = summary?.title ?? null

  if (activity) {
    const ran = activity.paceSecPerKm !== null
      ? t.sessionCard.ranAt(formatDistance(activity.distanceKm), formatPace(activity.paceSecPerKm))
      : t.sessionCard.ran(formatDistance(activity.distanceKm))
    const planned = plannedKm(workout)
    return {
      state: 'done',
      title: workoutTitle ?? (activity.description || t.activityTypes[activity.type]),
      detail: [ran, planned ? t.sessionCard.plannedKm(planned) : null].filter(Boolean).join(' · '),
      href: `/activities/${workout?.activityId ?? activity.id}`,
    }
  }

  if (workout && summary) {
    const planned = plannedKm(workout)
    // The main pace only, as the hero's line (M7): the strides pace is on
    // Plan's card, beside it, never merged into one range.
    const mainPace = summary.paces[0]
    return {
      state: 'planned',
      title: workoutTitle!,
      detail: [
        planned ? `${planned} ${t.units.km}` : null,
        workout.scheduledTime ? t.plan.timeOfDay[workout.scheduledTime] : null,
        mainPace ? `${formatClock(mainPace.pace[0])}–${formatClock(mainPace.pace[1])} ${t.units.perKm}` : workout.target,
      ].filter(Boolean).join(' · ') || null,
      // The session is on the plan, so the row goes to the plan.
      href: '/plan',
    }
  }

  return { state: 'rest', title: s.restDay, detail: s.restDaySubtitle }
}
