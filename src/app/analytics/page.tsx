import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getVO2maxHistory } from '@/application/usecases/GetVO2maxHistory'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export const revalidate = 60

export default async function AnalyticsPage() {
  const [data, comparison, vo2maxHistory, lifetime, zones] = await Promise.all([
    Promise.resolve(getAnalyticsData()),
    Promise.resolve(getYearComparison()),
    Promise.resolve(getVO2maxHistory()),
    Promise.resolve(getLifetimeStats()),
    getTrainingZones(),
  ])

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} comparison={comparison} vo2maxHistory={vo2maxHistory} lifetime={lifetime} zones={zones} />
    </div>
  )
}
