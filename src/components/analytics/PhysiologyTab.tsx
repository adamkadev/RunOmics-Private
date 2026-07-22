'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { LoadRiskPanel as LoadRiskPanelData } from '@/application/usecases/GetLoadRiskPanel'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import type { TrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { TrainingLoadChart } from '@/components/dashboard/TrainingLoadChart'
import { LoadRiskPanel } from './LoadRiskPanel'
import { LoadBalancePanel } from './LoadBalancePanel'
import { TrainingStatusHistoryChart } from './TrainingStatusHistoryChart'
import { HrTrendChart } from './HrTrendChart'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { RunningFormChart } from './RunningFormChart'
import { VO2maxChart } from './VO2maxChart'
import { TrainingZones } from './TrainingZones'

interface Props {
  weeklyTrends: WeeklyTrendPoint[]
  trainingLoad: TrainingLoadData | null
  loadRisk: LoadRiskPanelData | null
  loadBalance: LoadBalanceData | null
  statusHistory: TrainingStatusHistory | null
  vo2maxHistory: VO2maxSeries
  zones: TrainingZonesData | null
}

export function PhysiologyTab({
  weeklyTrends,
  trainingLoad,
  loadRisk,
  loadBalance,
  statusHistory,
  vo2maxHistory,
  zones,
}: Props) {
  return (
    <div className="space-y-4">
      {statusHistory && <TrainingStatusHistoryChart data={statusHistory} />}
      {trainingLoad && <TrainingLoadChart data={trainingLoad} />}
      {loadRisk && <LoadRiskPanel data={loadRisk} />}
      {loadBalance && <LoadBalancePanel data={loadBalance} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VO2maxChart series={vo2maxHistory} />
        <HrTrendChart points={weeklyTrends} />
        <ZoneDistributionChart points={weeklyTrends} />
        <div className="lg:col-span-2">
          <RunningFormChart points={weeklyTrends} />
        </div>
      </div>

      {zones && <TrainingZones data={zones} />}
    </div>
  )
}
