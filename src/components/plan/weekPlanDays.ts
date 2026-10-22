import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'
import { weekTarget, type WeekTarget, type WeekTargetDay } from '@/domain/training/weekTarget'
import { prescriptionDistanceMeters } from '@/components/coaching/presentation'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { formatKm } from '@/lib/formatters'
import { intendedType } from '@/lib/activityTitle'
import type { PlanPrescriptionView } from './planCoachingView'

type Run = Pick<ActivitySummary, 'date' | 'distanceKm'> & Partial<Pick<ActivitySummary, 'type' | 'description'>>
type Prescription = Pick<PlanPrescriptionView, 'state'> & {
  prescription: Pick<PlanPrescriptionView['prescription'], 'date' | 'type'> & Parameters<typeof prescriptionDistanceMeters>[0]
}

// Hardest-first, matching ACTIVITY_TYPES' own declaration order - a day with
// more than one logged activity (or a race day) resolves to whichever one is
// hardest, not just whichever came first.
const RAMP_ORDER: ActivityType[] = ['Race', 'Sprint', 'Anaerobic', 'VO2Max', 'Threshold', 'Tempo', 'Base']

export function hardestType(types: ActivityType[]): ActivityType {
  return types.reduce((hardest, type) =>
    RAMP_ORDER.indexOf(type) < RAMP_ORDER.indexOf(hardest) ? type : hardest
  )
}

export function resolvePlannedType(
  date: string,
  byDatePlanned: ReadonlyMap<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, readonly Prescription[]>
): ActivityType | undefined {
  const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
  if (coach) return COACHING_TO_ACTIVITY_TYPE[coach.prescription.type]
  return byDatePlanned.get(date)?.type
}

export interface DayTypeResolution {
  type: ActivityType
  /** Set only when the day was run and it differs from what was planned. */
  planned?: ActivityType
}

// One source of truth for a day's colour: the week strip and the "this week"
// rows both call this rather than each resolving a planned or recorded type on
// their own - which is how the same day used to end up two different hues in
// two places. A day that was actually run shows its run, not what was
// scheduled - the run as it was set, by its name (round 2): a threshold
// session the watch filed as tempo is the threshold the Activities list and
// the run's page show (intendedType).
export function resolveDayType(acts: readonly { type: ActivityType; description?: string }[], plannedType: ActivityType | undefined): DayTypeResolution | null {
  if (acts.length > 0) {
    const recorded = hardestType(acts.map((a) => intendedType(a)))
    return recorded !== plannedType && plannedType ? { type: recorded, planned: plannedType } : { type: recorded }
  }
  return plannedType ? { type: plannedType } : null
}

export interface PlanMaps<A extends Run = Run, P extends Prescription = Prescription> {
  byDate: ReadonlyMap<string, A[]>
  byDatePlanned: ReadonlyMap<string, PlannedWorkout>
  byDateCoach: ReadonlyMap<string, P[]>
}

/** The three per-day lookups Plan draws from, built once for any screen. */
export function planMaps<A extends Run, P extends Prescription>(
  activities: readonly A[],
  plannedWorkouts: readonly PlannedWorkout[],
  coachWorkouts: readonly P[] = [],
): PlanMaps<A, P> {
  const byDate = new Map<string, A[]>()
  for (const a of activities) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a])

  const byDatePlanned = new Map<string, PlannedWorkout>()
  for (const p of plannedWorkouts) byDatePlanned.set(p.date, p)

  const byDateCoach = new Map<string, P[]>()
  for (const view of coachWorkouts) {
    byDateCoach.set(view.prescription.date, [...(byDateCoach.get(view.prescription.date) ?? []), view])
  }

  return { byDate, byDatePlanned, byDateCoach }
}

export function weekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)))
}

/**
 * What each day planned and what it ran, in Plan's own priority: the coach's
 * prescriptions for a day win over Garmin's, and a cancelled prescription is
 * no plan at all.
 */
export function weekPlanDays(
  dates: readonly string[],
  { byDate, byDatePlanned, byDateCoach }: PlanMaps,
): WeekTargetDay[] {
  return dates.map((date) => {
    const runs = byDate.get(date) ?? []
    const coach = (byDateCoach.get(date) ?? []).filter((view) => view.state !== 'cancelled')
    const garmin = byDatePlanned.get(date)

    let plannedKm: number | null = null
    let plannedSessions = 0
    if (coach.length > 0) {
      plannedSessions = coach.length
      const meters = coach.map((view) => prescriptionDistanceMeters(view.prescription))
      if (meters.some((m) => m !== null)) plannedKm = meters.reduce<number>((sum, m) => sum + (m ?? 0), 0) / 1000
    } else if (garmin) {
      plannedSessions = 1
      plannedKm = garmin.distanceM !== undefined ? garmin.distanceM / 1000 : null
    }

    const typed = runs.filter((a): a is typeof a & { type: ActivityType } => a.type !== undefined)
    const resolved = resolveDayType(typed, resolvePlannedType(date, byDatePlanned, byDateCoach))

    return {
      date,
      ranKm: runs.reduce((sum, a) => sum + a.distanceKm, 0),
      runs: runs.length,
      plannedKm,
      plannedSessions,
      ...(resolved ? { type: resolved.type } : {}),
      ...(resolved?.planned ? { plannedType: resolved.planned } : {}),
    }
  })
}

/** The week that holds `today`, measured against its plan and the volume goal. */
export function currentWeekTarget(maps: PlanMaps, today: string, goalKm: number | null): WeekTarget {
  const monday = startOfWeek(new Date(`${today}T00:00:00`))
  return weekTarget(weekPlanDays(weekDates(monday), maps), today, goalKm)
}

/**
 * A week's km as the week cards write them: "6.1" for a short week, "52" once
 * a decimal stops telling the reader anything.
 */
export function formatWeekKm(km: number): string {
  const decimals = km < 10 && Math.round(km * 10) % 10 !== 0 ? 1 : 0
  return formatKm(km, decimals)
}
