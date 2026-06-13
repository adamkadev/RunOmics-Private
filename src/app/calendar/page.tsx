import { getActivities } from '@/application/usecases/GetActivities'
import { CalendarClient } from '@/components/calendar/CalendarClient'

export default function CalendarPage() {
  const activities = getActivities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Monthly training overview
        </p>
      </div>
      <CalendarClient activities={activities} />
    </div>
  )
}
