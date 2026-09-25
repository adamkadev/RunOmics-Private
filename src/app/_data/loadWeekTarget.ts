import 'server-only'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getCurrentWeeklyGoal } from '@/application/usecases/GetGoalsData'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import type { WeekTarget } from '@/domain/training/weekTarget'
import { currentWeekTarget, planMaps } from '@/components/plan/weekPlanDays'

/**
 * This week against its plan and the volume goal, for a server page. Plan
 * computes the same thing from the same maps on the client, so Today,
 * Activities and Plan give one answer.
 */
export async function loadWeekTarget(today: string, coaching: CoachingOverview | null): Promise<WeekTarget> {
  const goal = await getCurrentWeeklyGoal()
  const maps = planMaps(getActivitySummaries(), await getPlannedWorkouts(), coaching?.workouts ?? [])
  return currentWeekTarget(maps, today, goal?.targetKm ?? null)
}
