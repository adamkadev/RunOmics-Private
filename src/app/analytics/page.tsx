import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getVO2maxHistory } from '@/application/usecases/GetVO2maxHistory'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default async function AnalyticsPage() {
  const [data, comparison, vo2maxHistory, lifetime, zones, trainingLoad, loadRisk] = await Promise.all([
    getAnalyticsData(),
    Promise.resolve(getYearComparison()),
    Promise.resolve(getVO2maxHistory()),
    Promise.resolve(getLifetimeStats()),
    getTrainingZones(),
    getTrainingLoad(),
    getLoadRiskPanel(),
  ])

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
      />
    </div>
  )
}
