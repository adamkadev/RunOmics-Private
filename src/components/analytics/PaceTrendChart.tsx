'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { WindowedChartCard, trendDots, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { trendFromSeries } from '@/lib/chartTrend'
import { formatClock } from '@/lib/formatters'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; stroke: string; payload?: { label?: string } }>
}

// The X axis is keyed on the ISO date, so the header reads the point's own
// human label rather than Recharts' raw category value.
function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={payload[0]?.payload?.label}>
      {payload.map((p) => (
        <TooltipRow
          key={p.dataKey}
          color={p.stroke}
          name={p.dataKey === 'easyPace' ? t.analytics.charts.paceTrend.easy : t.analytics.charts.paceTrend.workout}
          value={`${formatClock(p.value)} /${t.units.km}`}
        />
      ))}
    </TooltipCard>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-subtle">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}
    </span>
  )
}

export function PaceTrendChart({ points }: { points: WeeklyTrendPoint[] }) {
  // Easy pace is the chart's primary series, so it follows the accent; the
  // workout line keeps CHART_COLORS.atl so hard efforts stay orange.
  const easyColor = useAccentUiColor()

  if (!points.some((p) => p.easyPace !== null || p.hardPace !== null)) return null

  const legend = (
    <>
      <LegendDot color={easyColor} label={t.analytics.charts.paceTrend.easy} />
      <LegendDot color={CHART_COLORS.atl} label={t.analytics.charts.paceTrend.workout} />
    </>
  )

  return (
    <WindowedChartCard
      title={t.analytics.charts.paceTrend.title}
      legend={legend}
      points={points}
      footnote={t.analytics.charts.paceTrend.footnote}
    >
      {(visible) => {
        const paces = visible.flatMap((d) => [d.easyPace, d.hardPace]).filter((p): p is number => p !== null)
        if (!paces.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const min = Math.min(...paces) - 10
        const max = Math.max(...paces) + 10
        const ticks = windowTicks(visible)

        const ex = t.analytics.charts.paceTrend.explains
        const trend = trendFromSeries(visible.map((d) => d.easyPace), 8)
        const explain = trend
          ? trend.direction === 'down'
            ? ex.improving(Math.abs(Math.round(trend.delta)))
            : trend.direction === 'up'
              ? ex.slowing(Math.round(trend.delta))
              : ex.stable
          : null
        const summary = `${t.analytics.charts.paceTrend.title}${explain ? `: ${explain}` : ''}`

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(date: string) => (ticks.has(date) ? windowTickDate(date) : '')}
                  />
                  <YAxis
                    domain={[min, max]}
                    reversed
                    tickFormatter={formatClock}
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="easyPace" stroke={easyColor} strokeWidth={3} {...trendDots(easyColor)} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="hardPace" stroke={CHART_COLORS.atl} strokeWidth={3} {...trendDots(CHART_COLORS.atl)} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartFigure>
            {explain && <ChartExplain text={explain} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
