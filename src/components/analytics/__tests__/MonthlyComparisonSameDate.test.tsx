import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthlyComparisonChart } from '../MonthlyComparisonChart'
import type { YearMetrics } from '@/application/usecases/GetYearComparison'
import { t } from '@/i18n'

const metrics = (year: number, km: number): YearMetrics => ({
  year, distanceKm: km, sessionCount: 0, durationSeconds: 0, avgKmPerWeek: 0, avgPaceSecPerKm: null, avgHeartRate: null, elevationM: 0,
})

describe('MonthlyComparisonChart', () => {
  // G03: "11% behind last year" compared 2026 so far with all of 2025.
  it('reads the same-date totals, naming the cut-off', () => {
    render(
      <MonthlyComparisonChart
        currentYear={2026}
        currentData={[{ month: '2026-01', totalKm: 120 } as never]}
        prevYear={2025}
        prevData={[{ month: '2025-04', totalKm: 90 } as never, { month: '2025-12', totalKm: 400 } as never]}
        comparison={{ years: [2026, 2025], cutoff: '2026-09-25', newer: metrics(2026, 1247), older: metrics(2025, 959) }}
      />,
    )
    expect(screen.getByText(t.analytics.charts.monthlyComparison.reading(30, '1,247', '959', 'Sep 25'))).toBeInTheDocument()
  })
})
