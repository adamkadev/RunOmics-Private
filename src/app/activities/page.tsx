import { queryActivities } from '@/application/usecases/QueryActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getMapShellData, getMapVersion } from '@/application/usecases/GetAllRoutes'
import { getExploreAreas } from '@/application/usecases/GetExploreAreas'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { appTodayIso } from '@/lib/calendarDate'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getCoachingOverview, getRunSessions } from '@/application/coaching/GetCoachingView'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { sessionNames, sessionTypes } from '@/components/activity/activityViews'
import { getCompletedSince } from '@/application/usecases/GetExploreGains'
import { explorePlansFrom } from '@/components/explore/explorePlan'
import { getUsualRunHour } from '@/application/usecases/GetHeatAhead'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export default async function ActivitiesPage() {
  await loadData()
  const { items, total } = queryActivities({ limit: 9999 })
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const today = appTodayIso()
  const coaching = getCoachingOverview(today)
  const sessions = getRunSessions()
  const exploreAreas = getExploreAreas()
  const { clusters, defaultClusterIdx } = getMapShellData()
  const defaultCluster = clusters[defaultClusterIdx]
  // Trimmed copies (name, distance, pace, usual start hour), never the coach's overview, and only where the map has Districts.
  const explorePlans = exploreAreas.length > 0
    ? explorePlansFrom(today, coaching?.workouts ?? [], await getPlannedWorkouts(), await getTrainingZones(), getUsualRunHour)
    : []

  return (
    <ActivityListClient
      initialItems={items}
      totalCount={total}
      qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      today={today}
      shoeNames={Object.fromEntries(getShoeStats().map((shoe) => [shoe.gearId, shoe.name]))}
      map={{ version: getMapVersion(), clusterId: defaultCluster?.id ?? null }}
      exploreAreas={exploreAreas}
      explorePlans={explorePlans}
      exploreCompletedSince={exploreAreas.length > 0 ? getCompletedSince() : undefined}
      sessionTypes={sessionTypes(sessions, items)}
      sessionNames={sessionNames(sessions, items)}
    />
  )
}
