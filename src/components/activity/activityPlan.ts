import type { ActivityType } from '@/domain/activity/types'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatDistance, formatDuration, formatDurationWords, formatKm, formatPlannedKm } from '@/lib/formatters'
import { t } from '@/i18n'

/** What the plan had for the day an activity was run - the fields the "vs plan" row reads. */
export interface ActivityPlan {
  title: string
  type?: ActivityType
  distanceM: number | null
  durationSeconds: number | null
}

export interface ActivityPlanRow {
  chipLabel: string
  title: string
  detail: string
}

/** "+0.11 km" / "−1.2 km"; nothing when the run matched the plan to 10 m. */
function kmDifference(km: number): string | null {
  if (Math.abs(km) < 0.01) return null
  const sign = km > 0 ? '+' : '−'
  return `${sign}${formatKm(Math.abs(km), Math.abs(km) >= 10 ? 1 : 2)} ${t.units.km}`
}

/**
 * Planned against ran for one activity, as its SessionCard row says it:
 * "✓ On plan · Planned 6 km · 25 min Z4 · Ran 6.11 km · 25:24". Plan against
 * actual used to exist only on Plan.
 */
export function activityPlanRow(
  activity: { type: ActivityType; distanceKm: number; durationSeconds: number },
  plan: ActivityPlan,
): ActivityPlanRow {
  const km = plan.distanceM ? formatPlannedKm(plan.distanceM / 1000) : null
  const effort = [
    plan.durationSeconds ? formatDurationWords(plan.durationSeconds) : null,
    plan.type ? EFFORT_ZONE_BY_TYPE[plan.type] : null,
  ].filter(Boolean).join(' ')
  const planned = [km ? t.sessionCard.plannedLine(km) : null, effort || null].filter(Boolean).join(' · ')
  const diverged = plan.type !== undefined && plan.type !== activity.type

  return {
    chipLabel: diverged ? `✓ ${t.sessionState.done}` : `✓ ${t.sessionCard.onPlan}`,
    title: planned || plan.title,
    detail: [
      t.sessionCard.ranLine(formatDistance(activity.distanceKm), formatDuration(activity.durationSeconds)),
      // The difference against the plan, from the plan's own distance: when
      // the planned value mirrored the run, "On plan" could never fail.
      plan.distanceM ? kmDifference(activity.distanceKm - plan.distanceM / 1000) : null,
      diverged ? t.plan.plannedVsRecorded(t.activityTypes[plan.type!], t.activityTypes[activity.type]) : null,
    ].filter(Boolean).join(' · '),
  }
}
