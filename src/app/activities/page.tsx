import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getPrLabelsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityListClient } from '@/components/activities/ActivityListClient'

export default async function ActivitiesPage() {
  // Load all activities upfront so scroll position is fully restorable on back navigation.
  const { items, total, nextOffset } = queryActivities({ limit: 9999 })
  const records = await getRecords()
  const prLabelsByActivityId = getPrLabelsByActivityId(records)

  return (
    <ActivityListClient
      initialItems={items}
      initialNextOffset={nextOffset}
      totalCount={total}
      prLabelsByActivityId={prLabelsByActivityId}
    />
  )
}
