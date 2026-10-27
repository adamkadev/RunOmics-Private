import { getAthleteProfile } from '@/application/usecases/GetAthleteProfile'
import { getActivities } from '@/application/usecases/GetActivities'
import { zoneDistribution, recentZoneDistribution } from '@/application/usecases/GetAnalyticsData'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { getFitnessAge } from '@/application/usecases/GetFitnessAge'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { appTodayIso, isoWeekNumber } from '@/lib/calendarDate'
import { AthleteClient } from '@/components/profile/AthleteClient'
import { athletePageView } from '@/components/profile/athleteView'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export default async function AthletePage() {
  await loadData()
  const athlete = getAthleteProfile()
  const activities = getActivities()

  const today = appTodayIso()
  const currentWeek = isoWeekNumber(new Date(`${today}T00:00:00`))
  const weeklyZoneTime = zoneDistribution(activities.filter((a) => a.week === currentWeek))

  const recentZoneTime = recentZoneDistribution(activities, 28)

  return (
    <AthleteClient
      athlete={athletePageView(athlete)}
      vo2Grade={getVo2Grade()}
      fitnessAge={getFitnessAge(today)}
      weeklyZoneTime={weeklyZoneTime}
      recentZoneTime={recentZoneTime}
      paceZones={await getTrainingZones()}
      lastSyncedAt={getLastSyncedAt()}
    />
  )
}
