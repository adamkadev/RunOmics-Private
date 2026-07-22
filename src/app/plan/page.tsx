import { getActivities } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingStatusCalendar } from '@/application/usecases/GetTrainingStatusCalendar'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { PlanClient } from '@/components/plan/PlanClient'
import type { HrBounds } from '@/domain/training/trimp'

export default async function PlanPage() {
  const activities = getActivities()
  const plannedWorkouts = await getPlannedWorkouts()
  const nextRace = await getNextRace()
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
      planPhaseRanges={getTrainingPlan()?.ranges ?? []}
      nextRace={nextRace}
    />
  )
}
