import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityListClient } from '@/components/activities/ActivityListClient'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the pbs Firestore collection is written.
export const revalidate = 86400

export default async function ActivitiesPage() {
  // Load all activities upfront so scroll position is fully restorable on back navigation.
  const { items, total, nextOffset } = queryActivities({ limit: 9999 })
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)

  return (
    <ActivityListClient
      initialItems={items}
      initialNextOffset={nextOffset}
      totalCount={total}
      qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
    />
  )
}
