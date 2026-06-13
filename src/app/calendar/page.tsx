import { getActivities } from '@/application/usecases/GetActivities'
import { CalendarClient } from '@/components/calendar/CalendarClient'

export default function CalendarPage() {
  const activities = getActivities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Monthly training overview
        </p>
      </div>
      <CalendarClient activities={activities} />
    </div>
  )
}
