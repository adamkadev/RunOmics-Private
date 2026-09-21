'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { RunningFormChart } from './RunningFormChart'
import { HrTrendChart } from './HrTrendChart'
import { LoadBalancePanel } from './LoadBalancePanel'

interface Props {
  weeklyTrends: WeeklyTrendPoint[]
  loadBalance: LoadBalanceData | null
}

export function HealthGroup({ weeklyTrends, loadBalance }: Props) {
  return (
    <div className="space-y-4">
      <ZoneDistributionChart points={weeklyTrends} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HrTrendChart points={weeklyTrends} />
        <RunningFormChart points={weeklyTrends} />
      </div>
      {loadBalance && <LoadBalancePanel data={loadBalance} />}
    </div>
  )
}
