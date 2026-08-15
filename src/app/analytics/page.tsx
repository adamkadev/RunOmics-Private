import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getSeasonInsight } from '@/application/usecases/GetSeasonInsight'
import { analyticsTabFacts } from '@/application/usecases/GetAnalyticsTabFacts'
import { getAnalyticsTabInsights } from '@/application/usecases/GetAnalyticsTabInsights'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getVO2maxSeries, getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getTrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getHeatImpact } from '@/application/usecases/GetHeatImpact'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export const revalidate = 3600

export default async function AnalyticsPage() {
  const [data, comparison, vo2maxHistory, trainingLoad, loadRisk] = await Promise.all([
    getAnalyticsData(),
    Promise.resolve(getYearComparison()),
    Promise.resolve(getVO2maxSeries()),
    getTrainingLoad(),
    getLoadRiskPanel(),
  ])

  const loadBalance = getLoadBalance()
  const statusHistory = getTrainingStatusHistory()
  const racePredictions = getGarminRacePredictions()
  const threshold = getThresholdHistory()

  const seasonHeadline = getSeasonHeadline(data, comparison)
  const seasonInsight = await getSeasonInsight(seasonHeadline)

  const tabInsights = await getAnalyticsTabInsights(
    analyticsTabFacts({
      data,
      status: await getTrainingStatus(),
      load: trainingLoad,
      loadRisk,
      loadBalance,
      threshold,
      racePredictions,
      vo2max: getLatestVO2max(),
    })
  )

  const athlete = getAthleteProfile()
  const latestVO2max = getLatestVO2max()
  const topPercent =
    latestVO2max !== null && athlete.age !== undefined && athlete.sex
      ? vo2maxTopPercent(latestVO2max, athlete.age, athlete.sex)
      : null
  const activeDays = getHeatmapData().filter((d) => d.distanceKm > 0).length
  const heatImpact = getHeatImpact()

  return (
    <div className="space-y-6">
      <AnalyticsClient
        data={data}
        comparison={comparison}
        seasonHeadline={seasonHeadline}
        seasonInsight={seasonInsight}
        tabInsights={tabInsights}
        vo2maxHistory={vo2maxHistory}
        trainingLoad={trainingLoad}
        loadRisk={loadRisk}
        loadBalance={loadBalance}
        statusHistory={statusHistory}
        racePredictions={racePredictions}
        threshold={threshold}
        vo2maxTopPercent={topPercent}
        activeDays={activeDays}
        heatImpact={heatImpact}
      />
    </div>
  )
}
