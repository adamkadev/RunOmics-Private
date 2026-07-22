'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { RpeTrendChart } from './RpeTrendChart'
import { RacePredictorChart } from './RacePredictorChart'

interface Props {
  weeklyTrends: WeeklyTrendPoint[]
  racePredictions: GarminRacePredictionsData | null
}

export function PerformanceTab({ weeklyTrends, racePredictions }: Props) {
  return (
    <div className="space-y-4">
      <PaceTrendChart points={weeklyTrends} />
      {racePredictions && <RacePredictorChart data={racePredictions} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EfficiencyChart points={weeklyTrends} />
        <RpeTrendChart points={weeklyTrends} />
      </div>
    </div>
  )
}
