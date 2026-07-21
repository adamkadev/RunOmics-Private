'use client'

import type {
  AnalyticsSeries,
  DailyRunningDynamics,
} from '@/application/usecases/GetAnalyticsData'
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
import { TrainingEffectChart } from './TrainingEffectChart'
import { RunningDynamicsTrendChart } from './RunningDynamicsTrendChart'
import { VO2maxChart } from './VO2maxChart'
import { TrainingZones } from './TrainingZones'

interface Props {
  series: AnalyticsSeries
  trainingLoad: TrainingLoadData | null
  loadRisk: LoadRiskPanelData | null
  loadBalance: LoadBalanceData | null
  statusHistory: TrainingStatusHistory | null
  vo2maxHistory: VO2maxSeries
  zones: TrainingZonesData | null
  runningDynamicsDaily: DailyRunningDynamics[]
  isAll: boolean
}

export function PhysiologyTab({
  series,
  trainingLoad,
  loadRisk,
  loadBalance,
  statusHistory,
  vo2maxHistory,
  zones,
  runningDynamicsDaily,
  isAll,
}: Props) {
  return (
    <div className="space-y-4">
      {statusHistory && <TrainingStatusHistoryChart data={statusHistory} />}
      {trainingLoad && <TrainingLoadChart data={trainingLoad} />}
      {loadRisk && <LoadRiskPanel data={loadRisk} />}
      {loadBalance && <LoadBalancePanel data={loadBalance} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VO2maxChart series={vo2maxHistory} />
        <HrTrendChart data={series.hrTrend} />
        <ZoneDistributionChart data={series.zoneDistribution} />
        <TrainingEffectChart data={series.trainingEffectTrend} />
        <div className="lg:col-span-2">
          <RunningFormChart data={series.runningFormTrend} />
        </div>
      </div>

      {!isAll && <RunningDynamicsTrendChart data={runningDynamicsDaily} />}

      {zones && <TrainingZones data={zones} />}
    </div>
  )
}
