import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingStatusCalendar } from '@/application/usecases/GetTrainingStatusCalendar'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getCurrentWeekPurpose } from '@/application/usecases/GetCurrentWeekPurpose'
import { getWeekPurposeInsight } from '@/application/usecases/GetWeekPurposeInsight'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { PlanClient } from '@/components/plan/PlanClient'
import type { HrBounds } from '@/domain/training/trimp'

export const revalidate = 3600

export default async function PlanPage() {
  const activities = getActivitySummaries()
  const plannedWorkouts = await getPlannedWorkouts()
  const nextRace = await getNextRace()
  const trainingZones = await getTrainingZones()
  const trainingPlan = getTrainingPlan()
  const athlete = getAthleteProfile()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  return (
    <PlanClient
      activities={activities}
      plannedWorkouts={plannedWorkouts}
      hrBounds={hrBounds}
      statusByDate={getTrainingStatusCalendar()}
      planPhaseRanges={trainingPlan?.ranges ?? []}
      planSpan={trainingPlan}
      nextRace={nextRace}
      trainingZones={trainingZones}
      weekPurposeTake={await getWeekPurposeInsight(await getCurrentWeekPurpose())}
    />
  )
}
