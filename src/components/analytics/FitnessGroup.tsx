'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { LoadRiskPanel as LoadRiskPanelData } from '@/application/usecases/GetLoadRiskPanel'
import type { TrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import { TrainingLoadChart } from '@/components/dashboard/TrainingLoadChart'
import { TrainingStatusHistoryChart } from './TrainingStatusHistoryChart'
import { VO2maxChart } from './VO2maxChart'
import { LoadRiskPanel } from './LoadRiskPanel'

interface Props {
  trainingLoad: TrainingLoadData | null
  statusHistory: TrainingStatusHistory | null
  vo2maxHistory: VO2maxSeries
  loadRisk: LoadRiskPanelData | null
  // Accepted for signature parity with the other groups; not rendered here.
  weeklyTrends?: WeeklyTrendPoint[]
}

// "Am I getting fitter?" — the training-load story: fitness/fatigue/form, the
// status ladder, VO₂max and the load-risk read.
export function FitnessGroup({ trainingLoad, statusHistory, vo2maxHistory, loadRisk }: Props) {
  return (
    <div className="space-y-4">
      {trainingLoad && <TrainingLoadChart data={trainingLoad} />}
      {statusHistory && <TrainingStatusHistoryChart data={statusHistory} />}
      <VO2maxChart series={vo2maxHistory} />
      {loadRisk && <LoadRiskPanel data={loadRisk} />}
    </div>
  )
}
