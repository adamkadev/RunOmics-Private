import { getActivities } from '@/application/usecases/GetActivities'
import { CalendarClient } from '@/components/calendar/CalendarClient'
import { t } from '@/i18n'

export default function CalendarPage() {
  const activities = getActivities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-foreground">{t.pages.calendar.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t.pages.calendar.subtitle}
        </p>
      </div>
      <CalendarClient activities={activities} />
    </div>
  )
}
