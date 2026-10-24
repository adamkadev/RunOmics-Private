import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getMapShellData } from '@/application/usecases/GetAllRoutes'
import { getExploreAreas } from '@/application/usecases/GetExploreAreas'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { appTodayIso } from '@/lib/calendarDate'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { sessionTypes } from '@/components/activity/activityViews'
import { explorePlansFrom } from '@/components/explore/explorePlan'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export default async function ActivitiesPage() {
  await loadData()
  const { items, total } = queryActivities({ limit: 9999 })
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const today = appTodayIso()
  const coaching = getCoachingOverview(today)
  const exploreAreas = getExploreAreas()
  // Trimmed copies (name, distance, pace), never the coach's overview, and only where the map has Districts.
  const explorePlans = exploreAreas.length > 0
    ? explorePlansFrom(today, coaching?.workouts ?? [], await getPlannedWorkouts(), await getTrainingZones())
    : []

  return (
    <ActivityListClient
      initialItems={items}
      totalCount={total}
      qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      today={today}
      shoeNames={Object.fromEntries(getShoeStats().map((shoe) => [shoe.gearId, shoe.name]))}
      mapData={getMapShellData()}
      exploreAreas={exploreAreas}
      explorePlans={explorePlans}
      sessionTypes={sessionTypes(coaching?.workouts ?? [], items)}
    />
  )
}
