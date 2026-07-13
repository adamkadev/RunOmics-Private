import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { zoneDistribution, recentZoneDistribution } from '@/application/usecases/GetAnalyticsData'
import { isoWeekNumber } from '@/lib/calendarDate'
import { AthleteClient } from '@/components/profile/AthleteClient'

export default async function AthletePage() {
  const athlete = getAthleteProfile()
  const activities = getAllActivities()

  const currentWeek = isoWeekNumber(new Date())
  const weeklyZoneTime = zoneDistribution(activities.filter((a) => a.week === currentWeek))

  const recentZoneTime = recentZoneDistribution(activities, 28)

  return <AthleteClient athlete={athlete} weeklyZoneTime={weeklyZoneTime} recentZoneTime={recentZoneTime} />
}
