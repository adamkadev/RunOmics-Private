import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getPrLabelsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { t } from '@/i18n'

export const revalidate = 60

export default async function ActivitiesPage() {
  const activities = getActivities()
  const records = await getRecords()
  const prLabelsByActivityId = getPrLabelsByActivityId(records)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-foreground">{t.pages.activities.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t.pages.activities.subtitle(activities.length)}
        </p>
      </div>
      <ActivityListClient activities={activities} prLabelsByActivityId={prLabelsByActivityId} />
    </div>
  )
}
