import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { PlanClient } from '@/components/plan/PlanClient'
import { planCoachingView } from '@/components/plan/planCoachingView'
import type { HrBounds } from '@/domain/training/trimp'

export const revalidate = 3600

export default async function PlanPage() {
  const activities = getActivitySummaries()
  const plannedWorkouts = await getPlannedWorkouts()
  const nextRace = await getNextRace()
  const trainingZones = await getTrainingZones()
  const trainingPlan = getTrainingPlan()
  const athlete = getAthleteProfile()
  const coaching = getCoachingOverview()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  return (
    <PlanClient
      activities={activities}
      plannedWorkouts={plannedWorkouts}
      hrBounds={hrBounds}
      planPhaseRanges={trainingPlan?.ranges ?? []}
      planSpan={trainingPlan}
      nextRace={nextRace}
      trainingZones={trainingZones}
      coaching={coaching ? planCoachingView(coaching) : null}
    />
  )
}
