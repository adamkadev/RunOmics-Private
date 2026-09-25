'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatDate, formatKm, monthLabel } from '@/lib/formatters'
import type { MonthlyVolume } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartCardHead, ChartReading } from '@/components/ui/ChartCard'
import { t } from '@/i18n'

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => monthLabel(i + 1))

interface Props {
  currentYear: number
  currentData: MonthlyVolume[]
  prevYear: number
  prevData: MonthlyVolume[]
  /** The same-date totals the sentence reads, shared with Year over Year and
   *  the Progress hub. */
  comparison: YearComparisonData | null
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; stroke: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={label}>
      {payload.map((p, i) => (
        <TooltipRow
          key={`${p.name}-${i}`}
          color={p.stroke}
          name={p.name}
          value={`${p.value.toFixed(1)} ${t.units.km}`}
        />
      ))}
    </TooltipCard>
  )
}

export function MonthlyComparisonChart({ currentYear, currentData, prevYear, prevData, comparison }: Props) {
  const accentColor = useAccentUiColor()
  // A year's line starts at its first month with a run: the months before it
  // were drawn as 0 km, which is invented data.
  const firstMonth = (data: MonthlyVolume[]) =>
    Math.min(...data.filter((d) => d.totalKm > 0).map((d) => Number(d.month.slice(5, 7))), 13)
  const firstCurrent = firstMonth(currentData)
  const firstPrev = firstMonth(prevData)
  const merged = MONTH_LABELS.map((label, i) => {
    const month = i + 1
    const monthStr = String(month).padStart(2, '0')
    const curr = currentData.find((d) => d.month.endsWith(`-${monthStr}`))
    const prev = prevData.find((d) => d.month.endsWith(`-${monthStr}`))
    return {
      label,
      [currentYear]: month >= firstCurrent ? (curr?.totalKm ?? null) : null,
      [prevYear]: month >= firstPrev ? (prev?.totalKm ?? null) : null,
    }
  })

  const curTotal = currentData.reduce((s, d) => s + d.totalKm, 0)
  const prevTotal = prevData.reduce((s, d) => s + d.totalKm, 0)
  const summary = `${t.analytics.charts.monthlyComparison.title}: ${currentYear} ${curTotal.toFixed(0)} ${t.units.km}, ${prevYear} ${prevTotal.toFixed(0)} ${t.units.km}`
  // The sentence compares like with like: this year to date against last year
  // to the same date, the totals Year over Year and the Progress hub show.
  const sameDate = comparison && comparison.years[0] === currentYear && comparison.years[1] === prevYear ? comparison : null
  const reading = sameDate && sameDate.older.distanceKm > 0
    ? t.analytics.charts.monthlyComparison.reading(
        Math.round(((sameDate.newer.distanceKm - sameDate.older.distanceKm) / sameDate.older.distanceKm) * 100),
        formatKm(sameDate.newer.distanceKm),
        formatKm(sameDate.older.distanceKm),
        sameDate.cutoff ? formatDate(sameDate.cutoff, { style: 'bare', year: 'never' }) : null,
      )
    : null

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead
        title={t.analytics.charts.monthlyComparison.title}
        controls={
          <div className="flex items-center gap-4 text-xs text-subtle">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: accentColor }} />
              {currentYear}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: CHART_COLORS.axisTick }} />
              {prevYear}
            </span>
          </div>
        }
      />

      {reading && <ChartReading>{reading}</ChartReading>}

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              unit=" km"
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="linear"
              dataKey={currentYear}
              stroke={accentColor}
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="linear"
              dataKey={prevYear}
              stroke={CHART_COLORS.axisTick}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
    </GlassSurface>
  )
}
