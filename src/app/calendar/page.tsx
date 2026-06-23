import { getActivities } from '@/application/usecases/GetActivities'
import { CalendarClient } from '@/components/calendar/CalendarClient'

export default function CalendarPage() {
  const activities = getActivities()

  return <CalendarClient activities={activities} />
}
