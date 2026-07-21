'use client'

import type { AnalyticsSeries, DailyEfficiency } from '@/application/usecases/GetAnalyticsData'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { DailyEfficiencyChart } from './DailyEfficiencyChart'
import { RpeTrendChart } from './RpeTrendChart'
import { RacePredictorChart } from './RacePredictorChart'
import { ThresholdChart } from './ThresholdChart'

interface Props {
  series: AnalyticsSeries
  efficiencyDaily: DailyEfficiency[]
  racePredictions: GarminRacePredictionsData | null
  threshold: ThresholdHistoryData | null
  isAll: boolean
}

export function PerformanceTab({ series, efficiencyDaily, racePredictions, threshold, isAll }: Props) {
  return (
    <div className="space-y-4">
      <PaceTrendChart data={series.paceTrend} />
      {racePredictions && <RacePredictorChart data={racePredictions} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Efficiency lives here rather than in Physiology, so the bucketed and
            the 90-day rolling read of the same metric sit side by side instead
            of in two different tabs. */}
        <EfficiencyChart data={series.efficiencyTrend} />
        {!isAll && <DailyEfficiencyChart data={efficiencyDaily} />}
        <RpeTrendChart data={series.rpeTrend} />
        {threshold && <ThresholdChart data={threshold} />}
      </div>
    </div>
  )
}
