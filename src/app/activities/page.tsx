import { getActivities } from '@/application/usecases/GetActivities'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { t } from '@/i18n'

export default function ActivitiesPage() {
  const activities = getActivities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.activities.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t.pages.activities.subtitle(activities.length)}
        </p>
      </div>
      <ActivityListClient activities={activities} />
    </div>
  )
}
