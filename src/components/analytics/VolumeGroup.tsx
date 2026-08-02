'use client'

import type { AnalyticsSeries, WeeklyTrendPoint, YearAnalytics } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { WeeklyVolumeChart } from './WeeklyVolumeChart'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { EasyHardChart } from './EasyHardChart'
import { LongRunsChart } from './LongRunsChart'
import { DistanceDistributionChart } from './DistanceDistributionChart'
import { MonthlyComparisonChart } from './MonthlyComparisonChart'
import { YearComparisonSection } from './YearComparisonSection'

interface Props {
  series: AnalyticsSeries
  // Week-by-week volume, which is the grain training is actually planned in -
  // the monthly charts below it smooth over exactly the build/recover cycle it
  // shows. Unscoped by year, like every other windowed trend chart.
  weeklyTrends: WeeklyTrendPoint[]
  // Season-over-season context, shown only for a specific year that has a
  // comparable previous season.
  year: number | null
  years: number[]
  byYear: Record<number, YearAnalytics>
  comparison: YearComparisonData | null
}

// "How much am I running?" - the single volume home: week-to-week volume, then
// monthly volume, the 80/20 split, long runs and distance mix, plus
// season-over-season context.
export function VolumeGroup({ series, weeklyTrends, year, years, byYear, comparison }: Props) {
  const prevYear =
    year !== null ? (years.find((y) => y < year) ?? years.find((y) => y !== year)) : undefined

  return (
    <div className="space-y-4">
      <WeeklyVolumeChart points={weeklyTrends} />
      <MonthlyVolumeChart data={series.monthlyVolume} typesPresent={series.typesPresent} />
      <EasyHardChart data={series.easyHardSplit} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LongRunsChart data={series.longRuns} />
        <DistanceDistributionChart data={series.distanceDistribution} />
      </div>

      {year !== null && prevYear !== undefined && (
        <MonthlyComparisonChart
          currentYear={year}
          currentData={series.monthlyVolume}
          prevYear={prevYear}
          prevData={byYear[prevYear]?.monthlyVolume ?? []}
        />
      )}

      {comparison && <YearComparisonSection data={comparison} />}
    </div>
  )
}
