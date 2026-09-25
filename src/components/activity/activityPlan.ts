import type { ActivityType } from '@/domain/activity/types'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatDistance, formatDuration, formatDurationWords, formatKm } from '@/lib/formatters'
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

/**
 * Planned against ran for one activity, as its SessionCard row says it:
 * "✓ On plan · Planned 6 km · 25 min Z4 · Ran 6.11 km · 25:24". Plan against
 * actual used to exist only on Plan.
 */
export function activityPlanRow(
  activity: { type: ActivityType; distanceKm: number; durationSeconds: number },
  plan: ActivityPlan,
): ActivityPlanRow {
  const km = plan.distanceM ? formatKm(plan.distanceM / 1000, plan.distanceM % 1000 === 0 ? 0 : 1) : null
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
      diverged ? t.plan.plannedVsRecorded(t.activityTypes[plan.type!], t.activityTypes[activity.type]) : null,
    ].filter(Boolean).join(' · '),
  }
}
