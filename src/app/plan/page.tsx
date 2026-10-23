import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getExploreHome } from '@/application/usecases/GetExploreAreas'
import { PlanClient } from '@/components/plan/PlanClient'
import { planCoachingView } from '@/components/plan/planCoachingView'
import { appTodayIso } from '@/lib/calendarDate'

export const revalidate = 3600

export default async function PlanPage() {
  const today = appTodayIso()
  const activities = getActivitySummaries()
  const plannedWorkouts = await getPlannedWorkouts()
  const nextRace = await getNextRace(today)
  const trainingZones = await getTrainingZones()
  const trainingPlan = getTrainingPlan()
  const coaching = getCoachingOverview(today)
  const athlete = getAthleteProfile()

  return (
    <PlanClient
      activities={activities}
      plannedWorkouts={plannedWorkouts}
      planPhaseRanges={trainingPlan?.ranges ?? []}
      nextRace={nextRace}
      trainingZones={trainingZones}
      hrZoneBoundsBpm={athlete.hrZoneBoundsBpm ?? null}
      coaching={coaching ? planCoachingView(coaching) : null}
      today={today}
      // Only whether there is one: the area and the runs stay on the server.
      exploreAvailable={getExploreHome() !== null}
    />
  )
}
