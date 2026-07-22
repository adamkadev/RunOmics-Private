import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getVO2maxSeries, getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getTrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getFormProjection } from '@/application/usecases/GetFormProjection'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export const revalidate = 3600

export default async function AnalyticsPage() {
  const [data, comparison, vo2maxHistory, lifetime, trainingLoad, loadRisk] = await Promise.all([
    getAnalyticsData(),
    Promise.resolve(getYearComparison()),
    Promise.resolve(getVO2maxSeries()),
    Promise.resolve(getLifetimeStats()),
    getTrainingLoad(),
    getLoadRiskPanel(),
  ])

  const loadBalance = getLoadBalance()
  const statusHistory = getTrainingStatusHistory()
  const racePredictions = getGarminRacePredictions()
  const threshold = getThresholdHistory()
  const formProjection = await getFormProjection()

  const seasonHeadline = getSeasonHeadline(data, comparison)

  // Insight-card context, all read from already-computed series:
  const athlete = getAthleteProfile()
  const latestVO2max = getLatestVO2max()
  const topPercent =
    latestVO2max !== null && athlete.age !== undefined && athlete.sex
      ? vo2maxTopPercent(latestVO2max, athlete.age, athlete.sex)
      : null
  const activeDays = getHeatmapData().filter((d) => d.distanceKm > 0).length

  return (
    <div className="space-y-6">
      <AnalyticsClient
        data={data}
        comparison={comparison}
        seasonHeadline={seasonHeadline}
        vo2maxHistory={vo2maxHistory}
        lifetime={lifetime}
        trainingLoad={trainingLoad}
        loadRisk={loadRisk}
        loadBalance={loadBalance}
        statusHistory={statusHistory}
        racePredictions={racePredictions}
        threshold={threshold}
        vo2maxTopPercent={topPercent}
        activeDays={activeDays}
        formProjection={formProjection}
      />
    </div>
  )
}
