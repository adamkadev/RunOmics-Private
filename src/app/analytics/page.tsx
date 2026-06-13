import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default function AnalyticsPage() {
  const data = getAnalyticsData()
  const comparison = getYearComparison()

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} comparison={comparison} />
    </div>
  )
}
