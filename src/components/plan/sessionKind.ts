import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { isLongName, isLongSession } from '@/domain/activity/longRun'
import { sessionZone, zoneColor, zoneTextColor } from '@/lib/colors'
import { t } from '@/i18n'
import type { PlanPrescriptionView } from './planCoachingView'
import { resolveDayType, resolvePlannedType } from './weekPlanDays'

export type SessionKind = 'easy' | 'long' | 'quality'

export interface DayKind {
  type: ActivityType
  kind: SessionKind
  color: string
  text: string
}

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

/** The long run shares the easy blue by design; its letter tells it apart. */
export function kindColor(type: ActivityType): string {
  return zoneColor(sessionZone({ type }))
}

export function kindTextColor(type: ActivityType): string {
  return zoneTextColor(sessionZone({ type }))
}

export function kindLetter(type: ActivityType, kind: SessionKind): string {
  const letters = t.plan.typeLetters
  return kind === 'quality' ? (letters[type] ?? letters.easy!) : (letters[kind] ?? letters.easy!)
}

export function kindLabel(type: ActivityType, kind: SessionKind): string {
  return kind === 'quality' ? t.activityTypes[type] : t.plan.kinds[kind]
}

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
  return { type: resolved.type, kind, color: kindColor(resolved.type), text: kindTextColor(resolved.type) }
}
