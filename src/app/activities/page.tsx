import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityListClient } from '@/components/activities/ActivityListClient'

export const revalidate = 3600

export default async function ActivitiesPage() {
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
