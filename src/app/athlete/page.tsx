import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { zoneDistribution, recentZoneDistribution } from '@/application/usecases/GetAnalyticsData'
import { isoWeekNumber } from '@/lib/calendarDate'
import { AthleteClient } from '@/components/profile/AthleteClient'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the athlete Firestore collection is written.
export const revalidate = 86400

export default async function AthletePage() {
  const athlete = await getAthleteFromFirestore()
  const activities = getAllActivities()

  const currentWeek = isoWeekNumber(new Date())
  const weeklyZoneTime = zoneDistribution(activities.filter((a) => a.week === currentWeek))

  const recentZoneTime = recentZoneDistribution(activities, 28)

  return <AthleteClient athlete={athlete} weeklyZoneTime={weeklyZoneTime} recentZoneTime={recentZoneTime} />
}
