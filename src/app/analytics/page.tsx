import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getVO2maxHistory } from '@/application/usecases/GetVO2maxHistory'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default function AnalyticsPage() {
  const data = getAnalyticsData()
  const comparison = getYearComparison()
  const zones = getTrainingZones()
  const vo2maxHistory = getVO2maxHistory()

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} comparison={comparison} zones={zones} vo2maxHistory={vo2maxHistory} />
    </div>
  )
}
