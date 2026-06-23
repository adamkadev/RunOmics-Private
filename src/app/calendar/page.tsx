import { getActivities } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { CalendarClient } from '@/components/calendar/CalendarClient'

export default function CalendarPage() {
  const activities = getActivities()
  const plannedWorkouts = getPlannedWorkouts()

  return <CalendarClient activities={activities} plannedWorkouts={plannedWorkouts} />
}
