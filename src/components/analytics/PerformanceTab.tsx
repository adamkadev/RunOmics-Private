'use client'

import type {
  AnalyticsSeries,
  RpeLoadPoint,
  TemperaturePoint,
} from '@/application/usecases/GetAnalyticsData'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { RpeTrendChart } from './RpeTrendChart'
import { TemperatureCorrelationChart } from './TemperatureCorrelationChart'
import { RpeLoadCorrelationChart } from './RpeLoadCorrelationChart'

interface Props {
  series: AnalyticsSeries
  temperatureScatter: TemperaturePoint[]
  rpeLoadCorrelation: RpeLoadPoint[]
}

export function PerformanceTab({ series, temperatureScatter, rpeLoadCorrelation }: Props) {
  return (
    <div className="space-y-4">
      <PaceTrendChart data={series.paceTrend} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EfficiencyChart data={series.efficiencyTrend} />
        <RpeTrendChart data={series.rpeTrend} />
      </div>
      {temperatureScatter.length >= 10 && (
        <TemperatureCorrelationChart data={temperatureScatter} />
      )}
      {rpeLoadCorrelation.length >= 10 && (
        <RpeLoadCorrelationChart data={rpeLoadCorrelation} />
      )}
    </div>
  )
}
