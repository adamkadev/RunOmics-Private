import { getActivities } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { CalendarClient } from '@/components/calendar/CalendarClient'

export default async function CalendarPage() {
  const activities = getActivities()
  const plannedWorkouts = await getPlannedWorkouts()

  return <CalendarClient activities={activities} plannedWorkouts={plannedWorkouts} />
}
