import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default function AnalyticsPage() {
  const data = getAnalyticsData()
  const comparison = getYearComparison()
  const zones = getTrainingZones()

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} comparison={comparison} zones={zones} />
    </div>
  )
}
