'use client'

import type { AnalyticsSeries } from '@/application/usecases/GetAnalyticsData'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { LongRunsChart } from './LongRunsChart'
import { DistanceDistributionChart } from './DistanceDistributionChart'
import { EasyHardChart } from './EasyHardChart'

export function VolumeTab({ series }: { series: AnalyticsSeries }) {
  return (
    <div className="space-y-4">
      <MonthlyVolumeChart data={series.monthlyVolume} typesPresent={series.typesPresent} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LongRunsChart data={series.longRuns} />
        <DistanceDistributionChart data={series.distanceDistribution} />
      </div>
      <EasyHardChart data={series.easyHardSplit} />
    </div>
  )
}
