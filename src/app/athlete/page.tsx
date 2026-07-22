import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { zoneDistribution, recentZoneDistribution } from '@/application/usecases/GetAnalyticsData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { isoWeekNumber } from '@/lib/calendarDate'
import { AthleteClient } from '@/components/profile/AthleteClient'

export const revalidate = 3600

export default async function AthletePage() {
  const athlete = getAthleteProfile()
  const activities = getAllActivities()

  const currentWeek = isoWeekNumber(new Date())
  const weeklyZoneTime = zoneDistribution(activities.filter((a) => a.week === currentWeek))

  const recentZoneTime = recentZoneDistribution(activities, 28)

  return (
    <AthleteClient
      athlete={athlete}
      latestVo2max={getLatestVO2max()}
      weeklyZoneTime={weeklyZoneTime}
      recentZoneTime={recentZoneTime}
      paceZones={await getTrainingZones()}
    />
  )
}
