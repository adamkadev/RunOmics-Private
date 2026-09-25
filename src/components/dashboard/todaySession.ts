import type { ActivitySummary } from '@/domain/activity/types'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { formatDistance, formatDurationWords, formatPace, formatPlannedKm } from '@/lib/formatters'
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
  const effort = workout
    ? [workout.duration ? formatDurationWords(workout.duration.seconds) : null, workout.type ? EFFORT_ZONE_BY_TYPE[workout.type] : null]
        .filter(Boolean)
        .join(' ')
    : ''
  const workoutTitle = workout ? [workout.title, effort].filter(Boolean).join(' · ') : null

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

  if (workout) {
    const planned = plannedKm(workout)
    return {
      state: 'planned',
      title: workoutTitle!,
      detail: [
        planned ? `${planned} ${t.units.km}` : null,
        workout.scheduledTime ? t.plan.timeOfDay[workout.scheduledTime] : null,
        workout.target,
      ].filter(Boolean).join(' · ') || null,
      // The session is on the plan, so the row goes to the plan.
      href: '/plan',
    }
  }

  return { state: 'rest', title: s.restDay, detail: s.restDaySubtitle }
}
