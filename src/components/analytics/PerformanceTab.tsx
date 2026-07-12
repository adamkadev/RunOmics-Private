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
import { t } from '@/i18n'

interface Props {
  series: AnalyticsSeries
  temperatureScatter: TemperaturePoint[]
  rpeLoadCorrelation: RpeLoadPoint[]
}

export function PerformanceTab({ series, temperatureScatter, rpeLoadCorrelation }: Props) {
  const showTemp = temperatureScatter.length >= 10
  const showRpeLoad = rpeLoadCorrelation.length >= 10

  return (
    <div className="space-y-4">
      <PaceTrendChart data={series.paceTrend} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EfficiencyChart data={series.efficiencyTrend} />
        <RpeTrendChart data={series.rpeTrend} />
      </div>
      {(showTemp || showRpeLoad) && (
        <div>
          <div className="grid grid-cols-2 gap-3">
            {showTemp && <TemperatureCorrelationChart data={temperatureScatter} />}
            {showRpeLoad && <RpeLoadCorrelationChart data={rpeLoadCorrelation} />}
          </div>
          <p className="mt-2 text-center text-[10.5px] text-subtle-2">{t.analytics.tapToExpand}</p>
        </div>
      )}
    </div>
  )
}
