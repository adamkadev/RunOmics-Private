'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { RunningFormChart } from './RunningFormChart'
import { HrTrendChart } from './HrTrendChart'
import { LoadBalancePanel } from './LoadBalancePanel'
import { TrainingZones } from './TrainingZones'

interface Props {
  weeklyTrends: WeeklyTrendPoint[]
  zones: TrainingZonesData | null
  loadBalance: LoadBalanceData | null
}

// "Is my training healthy?" — intensity distribution, running form, aerobic
// heart-rate trend, the Firstbeat load balance and the reference zones.
export function HealthGroup({ weeklyTrends, zones, loadBalance }: Props) {
  return (
    <div className="space-y-4">
      <ZoneDistributionChart points={weeklyTrends} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HrTrendChart points={weeklyTrends} />
        <RunningFormChart points={weeklyTrends} />
      </div>
      {loadBalance && <LoadBalancePanel data={loadBalance} />}
      {zones && <TrainingZones data={zones} />}
    </div>
  )
}
