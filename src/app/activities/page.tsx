import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { loadWeekTarget } from '@/app/_data/loadWeekTarget'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { appTodayIso } from '@/lib/calendarDate'
import { getShoeStats } from '@/application/usecases/GetShoeStats'

export const revalidate = 3600

export default async function ActivitiesPage() {
  const { items, total, nextOffset } = queryActivities({ limit: 9999 })
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const today = appTodayIso()

  return (
    <ActivityListClient
      weekTarget={await loadWeekTarget(today, getCoachingOverview(today))}
      initialItems={items}
      initialNextOffset={nextOffset}
      totalCount={total}
      qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      today={today}
      shoeNames={Object.fromEntries(getShoeStats().map((shoe) => [shoe.gearId, shoe.name]))}
    />
  )
}
