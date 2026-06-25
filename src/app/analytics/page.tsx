import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getVO2maxHistory } from '@/application/usecases/GetVO2maxHistory'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the athlete Firestore collection is written.
export const revalidate = 86400

export default async function AnalyticsPage() {
  const [data, comparison, vo2maxHistory, lifetime, zones] = await Promise.all([
    Promise.resolve(getAnalyticsData()),
    Promise.resolve(getYearComparison()),
    Promise.resolve(getVO2maxHistory()),
    Promise.resolve(getLifetimeStats()),
    getTrainingZones(),
  ])
  const trainingLoad = getTrainingLoad()

  return (
    <div className="space-y-6">
      <AnalyticsClient
        data={data}
        comparison={comparison}
        vo2maxHistory={vo2maxHistory}
        lifetime={lifetime}
        zones={zones}
        trainingLoad={trainingLoad}
      />
    </div>
  )
}
