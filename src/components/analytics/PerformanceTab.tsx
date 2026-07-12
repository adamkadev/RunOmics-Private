'use client'

import type {
  AnalyticsSeries,
} from '@/application/usecases/GetAnalyticsData'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { RpeTrendChart } from './RpeTrendChart'

interface Props {
  series: AnalyticsSeries
}

export function PerformanceTab({ series }: Props) {
  return (
    <div className="space-y-4">
      <PaceTrendChart data={series.paceTrend} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EfficiencyChart data={series.efficiencyTrend} />
        <RpeTrendChart data={series.rpeTrend} />
      </div>
    </div>
  )
}
