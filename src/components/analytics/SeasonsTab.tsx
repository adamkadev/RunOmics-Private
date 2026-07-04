'use client'

import type { AnalyticsSeries, YearAnalytics } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { MonthlyComparisonChart } from './MonthlyComparisonChart'
import { YearComparisonSection } from './YearComparisonSection'

interface Props {
  year: number
  years: number[]
  byYear: Record<number, YearAnalytics>
  series: AnalyticsSeries
  comparison: YearComparisonData | null
}

export function SeasonsTab({ year, years, byYear, series, comparison }: Props) {
  const prevYear = years.find((y) => y < year) ?? years.find((y) => y !== year)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {prevYear !== undefined && (
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
