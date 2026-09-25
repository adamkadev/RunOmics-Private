'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, tooltipNumber } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, latestOf, trendDots, windowDateAxis, windowTicks } from '@/components/ui/ChartWindowNav'
import { lineInterpolation } from '@/domain/timeWindow'
import { trendFromSeries } from '@/lib/chartTrend'
import { t } from '@/i18n'

// RPE is a 1-10 scale: the ticks, the line and the mean share it. The axis was
// fixed at 2-5 with the mean line at 3.5 whatever the data, so a week at 6
// ran above the top tick and the "average" sat under every point.
const RPE_DOMAIN: [number, number] = [1, 10]
const RPE_TICKS = [1, 5.5, 10]

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
        {t.analytics.charts.rpe.prefix} {tooltipNumber(point.value, (v) => v.toFixed(1))}
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
        const mean = values.reduce((s, v) => s + v, 0) / values.length
        const last = visible[visible.length - 1]
        const summary = `${t.analytics.charts.rpe.title}: ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`

        return (
          <ChartFigure summary={summary}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                <XAxis {...windowDateAxis(ticks)} />
                <YAxis
                  domain={RPE_DOMAIN}
                  ticks={RPE_TICKS}
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <ReferenceLine y={mean} stroke={CHART_COLORS.referenceLine} strokeDasharray="3 3" />
                {/* A last week without RPE is named rather than dropped silently. */}
                {last && last.avgRpe === null && (
                  <ReferenceDot
                    x={last.date}
                    y={(RPE_DOMAIN[0] + RPE_DOMAIN[1]) / 2}
                    r={0}
                    label={{ value: t.analytics.charts.rpe.noneLogged, position: 'insideRight', fontSize: 11, fill: CHART_COLORS.axisTick }}
                  />
                )}
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
