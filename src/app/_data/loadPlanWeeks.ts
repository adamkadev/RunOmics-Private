import 'server-only'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import { qualityKind } from '@/domain/training/qualitySession'
import type { WeekTargetDay } from '@/domain/training/weekTarget'
import { monthDays } from '@/domain/training/monthDays'
import { planMaps, resolvePlannedType, weekDates, weekPlanDays, type PlanMaps } from '@/components/plan/weekPlanDays'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'

export interface PlanWeek {
  /** Monday of the week. */
  week: string
  planKm: number | null
  planQuality: number
}

export interface PlanReading {
  weeks: PlanWeek[]
  /** Missed by Plan's own day states (monthDays): past, and no run on the day or inside its match window. */
  missed: string[]
}

/** Read the way Plan reads a week, so Analytics' "weeks on plan" and "plan asks for" agree with the Plan screen. */
export async function loadPlanWeeks(coaching: CoachingOverview | null, today: string): Promise<PlanReading> {
  const planned = await getPlannedWorkouts()
  const coach = coaching?.workouts ?? []
  const dates = [...planned.map((p) => p.date), ...coach.map((view) => view.prescription.date)].sort()
  return planReading(planMaps(getActivitySummaries(), planned, coach), dates, today)
}

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

  // Plan's own day states, not a second reading of them.
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
