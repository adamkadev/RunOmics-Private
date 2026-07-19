import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { zoneDistribution, recentZoneDistribution } from '@/application/usecases/GetAnalyticsData'
import { isoWeekNumber } from '@/lib/calendarDate'
import { AthleteClient } from '@/components/profile/AthleteClient'

// Keep in sync with DATE_SENSITIVE_REVALIDATE_SECONDS in @/lib/revalidate (see
// that file for why this can't just be imported here).
export const revalidate = 3600

export default async function AthletePage() {
  const athlete = getAthleteProfile()
  const activities = getAllActivities()

  const currentWeek = isoWeekNumber(new Date())
  const weeklyZoneTime = zoneDistribution(activities.filter((a) => a.week === currentWeek))

  const recentZoneTime = recentZoneDistribution(activities, 28)

  return <AthleteClient athlete={athlete} weeklyZoneTime={weeklyZoneTime} recentZoneTime={recentZoneTime} />
}
