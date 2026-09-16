'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, latestOf, trendDots, windowDateAxis, windowTicks } from '@/components/ui/ChartWindowNav'
import { lineInterpolation } from '@/domain/timeWindow'
import { trendFromSeries } from '@/lib/chartTrend'
import { t } from '@/i18n'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload?: { label?: string } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]
  if (!active || !point) return null
  return (
    <TooltipCard label={point.payload?.label}>
      <p className="text-sm font-semibold text-foreground">
        {t.analytics.charts.rpe.prefix} {point.value.toFixed(1)}
      </p>
    </TooltipCard>
  )
}

// Derived from the window on screen, and rendered above the chart rather than
// under it - see ChartReading.
function rpeReading(visible: WeeklyTrendPoint[]): string | null {
  const values = visible.map((d) => d.avgRpe).filter((v): v is number => v !== null)
  if (!values.length) return null
  const avg = (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
  const r = t.analytics.charts.rpe.reading
  const trend = trendFromSeries(values, 0.3)
  if (!trend) return null
  return trend.direction === 'down' ? r.down(avg) : trend.direction === 'up' ? r.up(avg) : r.flat(avg)
}

export function RpeTrendChart({ points }: { points: WeeklyTrendPoint[] }) {
  if (!points.some((p) => p.avgRpe !== null)) return null

  return (
    <WindowedChartCard
      title={t.analytics.charts.rpe.title}
      points={points}
      footnote={t.analytics.charts.rpe.footnote}
      reading={rpeReading}
      value={(visible) => {
        const rpe = latestOf(visible, (d) => d.avgRpe)
        return rpe !== null ? rpe.toFixed(1) : null
      }}
    >
      {(visible) => {
        const values = visible.map((d) => d.avgRpe).filter((v): v is number => v !== null)
        if (!values.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const ticks = windowTicks(visible)
        const summary = `${t.analytics.charts.rpe.title}: ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`

        return (
          <ChartFigure summary={summary}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                <XAxis {...windowDateAxis(ticks)} />
                <YAxis
                  domain={[2, 5]}
                  ticks={[2, 3, 4, 5]}
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <ReferenceLine y={3.5} stroke={CHART_COLORS.referenceLine} strokeDasharray="3 3" />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type={lineInterpolation(visible.length)}
                  dataKey="avgRpe"
                  stroke={CHART_COLORS.hr}
                  strokeWidth={3}
                  {...trendDots(CHART_COLORS.hr)}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFigure>
        )
      }}
    </WindowedChartCard>
  )
}
