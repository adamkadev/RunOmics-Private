import { getActivities } from '@/application/usecases/GetActivities'
import { getFullLoadHistory } from '@/application/usecases/GetTrainingLoad'
import { CalendarClient } from '@/components/calendar/CalendarClient'
import { t } from '@/i18n'

export default function CalendarPage() {
  const activities = getActivities()
  const loadHistory = getFullLoadHistory()
  const readiness = Object.fromEntries(
    Array.from(loadHistory.entries()).map(([date, snap]) => [date, snap.tsb])
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.calendar.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t.pages.calendar.subtitle}
        </p>
      </div>
      <CalendarClient activities={activities} readiness={readiness} />
    </div>
  )
}
