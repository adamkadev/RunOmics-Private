import { getActivities } from '@/application/usecases/GetActivities'
import { ActivityListClient } from '@/components/activities/ActivityListClient'

export default function ActivitiesPage() {
  const activities = getActivities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activities</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {activities.length} total activities
        </p>
      </div>
      <ActivityListClient activities={activities} />
    </div>
  )
}
