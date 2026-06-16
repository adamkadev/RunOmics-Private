import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getVO2maxHistory } from '@/application/usecases/GetVO2maxHistory'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default function AnalyticsPage() {
  const data = getAnalyticsData()
  const comparison = getYearComparison()
  const vo2maxHistory = getVO2maxHistory()
  const lifetime = getLifetimeStats()

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} comparison={comparison} vo2maxHistory={vo2maxHistory} lifetime={lifetime} />
    </div>
  )
}
