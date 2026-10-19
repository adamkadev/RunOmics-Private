import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { PlanClient } from '@/components/plan/PlanClient'
import { planCoachingView } from '@/components/plan/planCoachingView'
import { appTodayIso } from '@/lib/calendarDate'
import { hrBoundsFor } from '@/domain/training/hrBounds'

export const revalidate = 3600

export default async function PlanPage() {
  const today = appTodayIso()
  const activities = getActivitySummaries()
  const plannedWorkouts = await getPlannedWorkouts()
  const nextRace = await getNextRace(today)
  const trainingZones = await getTrainingZones()
  const trainingPlan = getTrainingPlan()
  const coaching = getCoachingOverview(today)

  return (
    <PlanClient
      activities={activities}
      plannedWorkouts={plannedWorkouts}
      hrBounds={hrBoundsFor(getAthleteProfile())}
      planPhaseRanges={trainingPlan?.ranges ?? []}
      nextRace={nextRace}
      trainingZones={trainingZones}
      coaching={coaching ? planCoachingView(coaching) : null}
      today={today}
    />
  )
}
