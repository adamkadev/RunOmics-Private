import 'server-only'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import { qualityKind } from '@/domain/training/qualitySession'
import { planMaps, resolvePlannedType, weekDates, weekPlanDays } from '@/components/plan/weekPlanDays'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'

/** What the plan scheduled in one week: its km, and its quality sessions. */
export interface PlanWeek {
  /** Monday of the week. */
  week: string
  planKm: number | null
  planQuality: number
}

/**
 * Every week the plan covers, read the way Plan reads a week (the coach's
 * prescriptions before Garmin's, a cancelled one is no plan), so Analytics'
 * "weeks on plan" and "plan asks for" agree with the Plan screen.
 */
export async function loadPlanWeeks(coaching: CoachingOverview | null): Promise<PlanWeek[]> {
  const planned = await getPlannedWorkouts()
  const coach = coaching?.workouts ?? []
  const maps = planMaps(getActivitySummaries(), planned, coach)
  const dates = [...planned.map((p) => p.date), ...coach.map((view) => view.prescription.date)].sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (!first || !last) return []

  const weeks: PlanWeek[] = []
  for (let monday = startOfWeek(new Date(`${first}T00:00:00`)); isoDate(monday) <= last; monday = addDays(monday, 7)) {
    const days = weekPlanDays(weekDates(monday), maps)
    const plannedDays = days.filter((d) => d.plannedSessions > 0)
    if (plannedDays.length === 0) continue
    weeks.push({
      week: isoDate(monday),
      planKm: plannedDays.some((d) => d.plannedKm !== null)
        ? Math.round(plannedDays.reduce((sum, d) => sum + (d.plannedKm ?? 0), 0) * 10) / 10
        : null,
      planQuality: plannedDays.filter((d) => qualityKind(resolvePlannedType(d.date, maps.byDatePlanned, maps.byDateCoach)) !== null).length,
    })
  }
  return weeks
}
