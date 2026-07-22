import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getVO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getTrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export const revalidate = 3600

export default async function AnalyticsPage() {
  const [data, comparison, vo2maxHistory, lifetime, zones, trainingLoad, loadRisk] = await Promise.all([
    getAnalyticsData(),
    Promise.resolve(getYearComparison()),
    Promise.resolve(getVO2maxSeries()),
    Promise.resolve(getLifetimeStats()),
    getTrainingZones(),
    getTrainingLoad(),
    getLoadRiskPanel(),
  ])

  const loadBalance = getLoadBalance()
  const statusHistory = getTrainingStatusHistory()
  const racePredictions = getGarminRacePredictions()

  const seasonHeadline = getSeasonHeadline(data, comparison)

  return (
    <div className="space-y-6">
      <AnalyticsClient
        data={data}
        comparison={comparison}
        seasonHeadline={seasonHeadline}
        vo2maxHistory={vo2maxHistory}
        lifetime={lifetime}
        zones={zones}
        trainingLoad={trainingLoad}
        loadRisk={loadRisk}
        loadBalance={loadBalance}
        statusHistory={statusHistory}
        racePredictions={racePredictions}
      />
    </div>
  )
}
