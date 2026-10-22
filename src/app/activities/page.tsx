import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getMapShellData } from '@/application/usecases/GetAllRoutes'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { appTodayIso } from '@/lib/calendarDate'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { sessionTypes } from '@/components/activity/activityViews'

export const revalidate = 3600

export default async function ActivitiesPage() {
  const { items, total, nextOffset } = queryActivities({ limit: 9999 })
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const today = appTodayIso()

  return (
    <ActivityListClient
      initialItems={items}
      initialNextOffset={nextOffset}
      totalCount={total}
      qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      today={today}
      shoeNames={Object.fromEntries(getShoeStats().map((shoe) => [shoe.gearId, shoe.name]))}
      mapData={getMapShellData()}
      sessionTypes={sessionTypes(getCoachingOverview(today)?.workouts ?? [], items)}
    />
  )
}
