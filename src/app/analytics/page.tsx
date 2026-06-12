import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default function AnalyticsPage() {
  const data = getAnalyticsData()
  return <AnalyticsClient data={data} />
}
