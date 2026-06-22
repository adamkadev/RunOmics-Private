import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getPrLabelsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityListClient } from '@/components/activities/ActivityListClient'

export const revalidate = 60

export default async function ActivitiesPage() {
  const activities = getActivities()
  const records = await getRecords()
  const prLabelsByActivityId = getPrLabelsByActivityId(records)

  return <ActivityListClient activities={activities} prLabelsByActivityId={prLabelsByActivityId} />
}
