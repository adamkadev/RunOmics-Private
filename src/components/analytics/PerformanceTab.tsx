'use client'

import type { DailyEfficiency, WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { DailyEfficiencyChart } from './DailyEfficiencyChart'
import { RpeTrendChart } from './RpeTrendChart'
import { RacePredictorChart } from './RacePredictorChart'
import { ThresholdChart } from './ThresholdChart'

interface Props {
  weeklyTrends: WeeklyTrendPoint[]
  efficiencyDaily: DailyEfficiency[]
  racePredictions: GarminRacePredictionsData | null
  threshold: ThresholdHistoryData | null
}

export function PerformanceTab({ weeklyTrends, efficiencyDaily, racePredictions, threshold }: Props) {
  return (
    <div className="space-y-4">
      <PaceTrendChart points={weeklyTrends} />
      {racePredictions && <RacePredictorChart data={racePredictions} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Both reads of aerobic efficiency sit here rather than across two tabs:
            the weekly one you can page through, and the daily rolling average. */}
        <EfficiencyChart points={weeklyTrends} />
        <DailyEfficiencyChart data={efficiencyDaily} />
        <RpeTrendChart points={weeklyTrends} />
        {threshold && <ThresholdChart data={threshold} />}
      </div>
    </div>
  )
}
