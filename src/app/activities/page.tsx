import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getPrLabelsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityListClient } from '@/components/activities/ActivityListClient'

export default async function ActivitiesPage() {
  const { items, total, nextOffset } = queryActivities({})
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
