import { getActivities } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { CalendarClient } from '@/components/calendar/CalendarClient'
import type { HrBounds } from '@/domain/training/trimp'

export default async function CalendarPage() {
  const activities = getActivities()
  const plannedWorkouts = await getPlannedWorkouts()
  const athlete = await getAthleteFromFirestore()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  return <CalendarClient activities={activities} plannedWorkouts={plannedWorkouts} hrBounds={hrBounds} />
}
