'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { WindowedChartCard, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { trendFromSeries } from '@/lib/chartTrend'
import { ChartFigure } from '@/components/ui/ChartFigure'
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
      <p className="text-sm font-semibold text-foreground">{point.value.toFixed(2)} {t.analytics.charts.efficiency.unit}</p>
    </TooltipCard>
  )
}

export function EfficiencyChart({ points }: { points: WeeklyTrendPoint[] }) {
  if (!points.some((p) => p.ef !== null)) return null

  return (
    <WindowedChartCard
      title={t.analytics.charts.efficiency.title}
      points={points}
      footnote={t.analytics.charts.efficiency.footnote}
    >
      {(visible) => {
        const values = visible.map((d) => d.ef).filter((v): v is number => v !== null)
        if (!values.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const min = Math.floor(Math.min(...values) * 10) / 10 - 0.05
        const max = Math.ceil(Math.max(...values) * 10) / 10 + 0.05
        const ticks = windowTicks(visible)

        const ex = t.analytics.charts.efficiency.explains
        const trend = trendFromSeries(visible.map((d) => d.ef), 0.03)
        const explain = trend
          ? trend.direction === 'up'
            ? ex.improving(Math.abs(trend.delta).toFixed(2))
            : trend.direction === 'down'
              ? ex.declining
              : ex.stable
          : null
        const summary = `${t.analytics.charts.efficiency.title}${explain ? `: ${explain}` : ''}`

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="efGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.efficiency} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS.efficiency} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(date: string) => (ticks.has(date) ? windowTickDate(date) : '')}
                  />
                  <YAxis
                    domain={[min, max]}
                    tickFormatter={(v: number) => v.toFixed(1)}
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="ef"
                    stroke={CHART_COLORS.efficiency}
                    strokeWidth={3}
                    fill="url(#efGradient)"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFigure>
            {explain && <ChartExplain text={explain} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
