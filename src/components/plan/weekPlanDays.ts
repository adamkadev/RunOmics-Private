import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import { weekTarget, type WeekTarget, type WeekTargetDay } from '@/domain/training/weekTarget'
import { prescriptionDistanceMeters } from '@/components/coaching/presentation'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { formatKm } from '@/lib/formatters'
import type { PlanPrescriptionView } from './planCoachingView'

type Run = Pick<ActivitySummary, 'date' | 'distanceKm'>
type Prescription = Pick<PlanPrescriptionView, 'state'> & {
  prescription: Pick<PlanPrescriptionView['prescription'], 'date'> & Parameters<typeof prescriptionDistanceMeters>[0]
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

    return {
      date,
      ranKm: runs.reduce((sum, a) => sum + a.distanceKm, 0),
      runs: runs.length,
      plannedKm,
      plannedSessions,
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
