'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { LoadRiskPanel as LoadRiskPanelData } from '@/application/usecases/GetLoadRiskPanel'
import type { TrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { TrainingLoadChart } from '@/components/dashboard/TrainingLoadChart'
import { ThresholdChart } from './ThresholdChart'
import { TrainingStatusHistoryChart } from './TrainingStatusHistoryChart'
import { LoadRiskPanel } from './LoadRiskPanel'
import { AnalyticsInsightCards } from './AnalyticsInsightCards'
import { RaceTimeCards } from './RaceTimeCards'

interface Props {
  trainingLoad: TrainingLoadData | null
  statusHistory: TrainingStatusHistory | null
  loadRisk: LoadRiskPanelData | null
  vo2maxHistory: VO2maxSeries
  vo2maxTopPercent: number | null
  weeklyTrends: WeeklyTrendPoint[]
  threshold: ThresholdHistoryData | null
  activeDays: number
  racePredictions: GarminRacePredictionsData | null
}

// The insight-first landing: the season's one hero chart, the four slow-moving
// reads as cards, the race-time teaser, then the threshold trend and the deeper
// load charts for anyone who wants them.
export function FitnessGroup({
  trainingLoad,
  statusHistory,
  loadRisk,
  vo2maxHistory,
  vo2maxTopPercent,
  weeklyTrends,
  threshold,
  activeDays,
  racePredictions,
}: Props) {
  return (
    <div className="space-y-4">
      {trainingLoad && <TrainingLoadChart data={trainingLoad} />}

      <AnalyticsInsightCards
        vo2maxSeries={vo2maxHistory}
        vo2maxTopPercent={vo2maxTopPercent}
        weeklyTrends={weeklyTrends}
        threshold={threshold}
        activeDays={activeDays}
      />

      {racePredictions && <RaceTimeCards data={racePredictions} />}

      {threshold && <ThresholdChart data={threshold} />}

      {statusHistory && <TrainingStatusHistoryChart data={statusHistory} />}
      {loadRisk && <LoadRiskPanel data={loadRisk} />}
    </div>
  )
}
