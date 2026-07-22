import { getProfileData } from '@/application/usecases/GetProfileData'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { recentZoneDistribution } from '@/application/usecases/GetAnalyticsData'
import { ProfileClient } from '@/components/profile/ProfileClient'

export const revalidate = 3600

export default async function ProfilePage() {
  const data = await getProfileData()
  const heatmapDays = getHeatmapData()
  const latestVo2max = getLatestVO2max()
  const recentZoneTime = recentZoneDistribution(getAllActivities(), 28)

  return (
    <ProfileClient
      data={data}
      heatmapDays={heatmapDays}
      latestVo2max={latestVo2max}
      recentZoneTime={recentZoneTime}
    />
  )
}
