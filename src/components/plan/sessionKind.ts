import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { isLongName, isLongSession } from '@/domain/activity/longRun'
import { LONG_RUN_COLOR, sessionZone, zoneColor } from '@/lib/colors'
import { t } from '@/i18n'
import type { PlanPrescriptionView } from './planCoachingView'
import { resolveDayType, resolvePlannedType } from './weekPlanDays'

/**
 * What a day is on Plan (redesign 3.0): an easy run, the long run, or a
 * quality session. Easy and quality keep the colour of their type's zone
 * (RUN_TYPE_ZONE), as every other screen draws them; the long run is the
 * easy blue a step deeper, so the week's one long day stands out.
 */
export type SessionKind = 'easy' | 'long' | 'quality'

export interface DayKind {
  type: ActivityType
  kind: SessionKind
  color: string
}

/** The coach's long_run, or a Garmin session its name calls the long run. */
export function plannedLong(
  date: string,
  byDatePlanned: ReadonlyMap<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, readonly PlanPrescriptionView[]>,
): boolean {
  const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
  if (coach) return coach.prescription.type === 'long_run'
  const plan = byDatePlanned.get(date)
  return !!plan && (plan.type === undefined || plan.type === 'Base') && isLongName(plan.name)
}

export function kindOf(type: ActivityType, long: boolean): SessionKind {
  if (type !== 'Base') return 'quality'
  return long ? 'long' : 'easy'
}

export function kindColor(type: ActivityType, kind: SessionKind): string {
  return kind === 'long' ? LONG_RUN_COLOR : zoneColor(sessionZone({ type }))
}

/** "Easy", "Long run", or the quality session's type: "Threshold". */
export function kindLabel(type: ActivityType, kind: SessionKind): string {
  return kind === 'quality' ? t.activityTypes[type] : t.plan.kinds[kind]
}

/**
 * A day's kind, by what was run when it was run and by what is planned
 * otherwise - the same priority as resolveDayType. A day run as an easy run
 * is the long run when the run was long or the plan said so.
 */
export function dayKind(
  date: string,
  acts: readonly Pick<ActivitySummary, 'type' | 'durationSeconds' | 'description'>[],
  byDatePlanned: ReadonlyMap<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, readonly PlanPrescriptionView[]>,
): DayKind | null {
  const resolved = resolveDayType(acts, resolvePlannedType(date, byDatePlanned, byDateCoach))
  if (!resolved) return null
  const long = plannedLong(date, byDatePlanned, byDateCoach) || acts.some((a) => a.type === 'Base' && isLongSession(a))
  const kind = kindOf(resolved.type, long)
  return { type: resolved.type, kind, color: kindColor(resolved.type, kind) }
}
