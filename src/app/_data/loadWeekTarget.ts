import 'server-only'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getCurrentWeeklyGoal } from '@/application/usecases/GetGoalsData'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import type { WeekTarget } from '@/domain/training/weekTarget'
import { currentWeekTarget, planMaps, weekPlanDays } from '@/components/plan/weekPlanDays'
import { addDays, isoDate } from '@/lib/calendarDate'

/** Plan computes the same thing from the same maps on the client, so Today, Activities and Plan give one answer. */
export async function loadWeekTarget(today: string, coaching: CoachingOverview | null): Promise<WeekTarget> {
  const goal = await getCurrentWeeklyGoal(today)
  const maps = planMaps(getActivitySummaries(), await getPlannedWorkouts(), coaching?.workouts ?? [])
  return currentWeekTarget(maps, today, goal?.targetKm ?? null)
}

export async function loadPlannedDates(today: string, until: string, coaching: CoachingOverview | null): Promise<string[]> {
  const maps = planMaps(getActivitySummaries(), await getPlannedWorkouts(), coaching?.workouts ?? [])
  const dates: string[] = []
  for (let d = new Date(`${today}T00:00:00`); isoDate(d) <= until; d = addDays(d, 1)) dates.push(isoDate(d))
  return weekPlanDays(dates, maps)
    .filter((day) => day.plannedSessions > 0 && day.runs === 0)
    .map((day) => day.date)
}
