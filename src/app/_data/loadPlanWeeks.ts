import 'server-only'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import { qualityKind } from '@/domain/training/qualitySession'
import type { WeekTargetDay } from '@/domain/training/weekTarget'
import { monthDays } from '@/components/plan/monthDays'
import { planMaps, resolvePlannedType, weekDates, weekPlanDays, type PlanMaps } from '@/components/plan/weekPlanDays'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'

/** What the plan scheduled in one week: its km, and its quality sessions. */
export interface PlanWeek {
  /** Monday of the week. */
  week: string
  planKm: number | null
  planQuality: number
}

export interface PlanReading {
  weeks: PlanWeek[]
  /**
   * The days with a planned session that was missed, by Plan's own day
   * states (monthDays): past, and no run on the day or inside its match
   * window. The Volume coach read finds where they came together.
   */
  missed: string[]
}

/**
 * Every week the plan covers, read the way Plan reads a week (the coach's
 * prescriptions before Garmin's, a cancelled one is no plan), so Analytics'
 * "weeks on plan" and "plan asks for" agree with the Plan screen.
 */
export async function loadPlanWeeks(coaching: CoachingOverview | null, today: string): Promise<PlanReading> {
  const planned = await getPlannedWorkouts()
  const coach = coaching?.workouts ?? []
  const dates = [...planned.map((p) => p.date), ...coach.map((view) => view.prescription.date)].sort()
  return planReading(planMaps(getActivitySummaries(), planned, coach), dates, today)
}

/** The reading from the plan's own per-day lookups, over the dates it has sessions on. */
export function planReading(maps: PlanMaps, dates: readonly string[], today: string): PlanReading {
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (!first || !last) return { weeks: [], missed: [] }

  const weeks: PlanWeek[] = []
  const days: WeekTargetDay[] = []
  for (let monday = startOfWeek(new Date(`${first}T00:00:00`)); isoDate(monday) <= last; monday = addDays(monday, 7)) {
    const week = weekPlanDays(weekDates(monday), maps)
    days.push(...week)
    const plannedDays = week.filter((d) => d.plannedSessions > 0)
    if (plannedDays.length === 0) continue
    weeks.push({
      week: isoDate(monday),
      planKm: plannedDays.some((d) => d.plannedKm !== null)
        ? Math.round(plannedDays.reduce((sum, d) => sum + (d.plannedKm ?? 0), 0) * 10) / 10
        : null,
      planQuality: plannedDays.filter((d) => qualityKind(resolvePlannedType(d.date, maps.byDatePlanned, maps.byDateCoach)) !== null).length,
    })
  }

  // Plan's day states, not a second reading of them: a run the day before
  // or after a session stands in for it, and today is never missed.
  const plannedOn = new Set(days.filter((d) => d.plannedSessions > 0).map((d) => d.date))
  const states = monthDays(
    days.map((d) => d.date),
    (date) => (maps.byDate.get(date)?.length ?? 0) > 0,
    (date) => plannedOn.has(date),
    today,
  )
  const missed = [...states].filter(([, day]) => day.state === 'missed').map(([date]) => date)
  return { weeks, missed }
}
