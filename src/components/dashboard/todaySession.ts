import type { ActivitySummary } from '@/domain/activity/types'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { formatDistance, formatDuration, formatPace, formatPlannedKm } from '@/lib/formatters'
import { t } from '@/i18n'

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

/** A run as the last-run row reads it: "8.0 km · 5:52 /km · 141 bpm · 46:58". */
export function runMeta(activity: ActivitySummary): string {
  return [
    `${formatDistance(activity.distanceKm)} ${t.units.km}`,
    activity.paceSecPerKm !== null ? formatPace(activity.paceSecPerKm) : null,
    activity.avgHeartRate !== null ? `${activity.avgHeartRate} ${t.units.bpm}` : null,
    formatDuration(activity.durationSeconds),
  ]
    .filter(Boolean)
    .join(' · ')
}
