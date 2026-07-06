'use client'

import { cn } from '@/lib/utils'
import type {
  AnalyticsSeries,
  DailyEfficiency,
  DailyRunningDynamics,
} from '@/application/usecases/GetAnalyticsData'
import type { VO2maxPoint } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { LoadRiskPanel as LoadRiskPanelData } from '@/application/usecases/GetLoadRiskPanel'
import { TrainingLoadChart } from '@/components/dashboard/TrainingLoadChart'
import { LoadRiskPanel } from './LoadRiskPanel'
import { HrTrendChart } from './HrTrendChart'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { CadenceTrendChart } from './CadenceTrendChart'
import { RunningFormChart } from './RunningFormChart'
import { TrainingEffectChart } from './TrainingEffectChart'
import { DailyEfficiencyChart } from './DailyEfficiencyChart'
import { RunningDynamicsTrendChart } from './RunningDynamicsTrendChart'
import { VO2maxChart } from './VO2maxChart'
import { TrainingZones } from './TrainingZones'

interface Props {
  series: AnalyticsSeries
  trainingLoad: TrainingLoadData | null
  loadRisk: LoadRiskPanelData | null
  vo2maxHistory: VO2maxPoint[]
  zones: TrainingZonesData | null
  efficiencyDaily: DailyEfficiency[]
  runningDynamicsDaily: DailyRunningDynamics[]
  isAll: boolean
}

export function PhysiologyTab({
  series,
  trainingLoad,
  loadRisk,
  vo2maxHistory,
  zones,
  efficiencyDaily,
  runningDynamicsDaily,
  isAll,
}: Props) {
  return (
    <div className="space-y-4">
      {trainingLoad && <TrainingLoadChart data={trainingLoad} />}
      {loadRisk && <LoadRiskPanel data={loadRisk} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {vo2maxHistory.length >= 2 && <VO2maxChart data={vo2maxHistory} />}
        <HrTrendChart data={series.hrTrend} />
        <ZoneDistributionChart data={series.zoneDistribution} />
        <CadenceTrendChart data={series.cadenceTrend} />
        <div className="lg:col-span-2">
          <RunningFormChart data={series.runningFormTrend} />
        </div>
      </div>

      <div className={cn('grid grid-cols-1 gap-4', !isAll && 'lg:grid-cols-2')}>
        <TrainingEffectChart data={series.trainingEffectTrend} />
        {!isAll && <DailyEfficiencyChart data={efficiencyDaily} />}
      </div>

      {!isAll && <RunningDynamicsTrendChart data={runningDynamicsDaily} />}

      {zones && <TrainingZones data={zones} />}
    </div>
  )
}
