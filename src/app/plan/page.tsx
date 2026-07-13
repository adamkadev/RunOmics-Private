import { getActivities } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { PlanClient } from '@/components/plan/PlanClient'
import type { HrBounds } from '@/domain/training/trimp'

export default async function PlanPage() {
  const activities = getActivities()
  const plannedWorkouts = await getPlannedWorkouts()
  const athlete = getAthleteProfile()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  return <PlanClient activities={activities} plannedWorkouts={plannedWorkouts} hrBounds={hrBounds} />
}
