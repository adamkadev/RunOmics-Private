'use client'

import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { WindowedChartCard, trendDots, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { trendFromSeries } from '@/lib/chartTrend'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

const HEAT_GAP_MIN = 0.02

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: WeeklyTrendPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const c = t.analytics.charts.efficiency
  return (
    <TooltipCard label={d.label}>
      {d.efAdjusted !== null && (
        <TooltipRow color={CHART_COLORS.efficiency} name={c.adjusted} value={`${d.efAdjusted.toFixed(2)} ${c.unit}`} />
      )}
      {d.ef !== null && (
        <TooltipRow color={CHART_COLORS.axisTick} name={c.measured} value={`${d.ef.toFixed(2)} ${c.unit}`} />
      )}
      {d.apparentTempC !== null && <p className="text-xs text-subtle">{c.felt(Math.round(d.apparentTempC))}</p>}
    </TooltipCard>
  )
}

function LegendMark({ label, dashed }: { label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1 text-xs text-subtle">
      <span
        className="h-0 w-4 border-t-2"
        style={{ borderColor: CHART_COLORS.efficiency, borderStyle: dashed ? 'dashed' : 'solid' }}
      />
      {label}
    </span>
  )
}

export function EfficiencyChart({ points }: { points: WeeklyTrendPoint[] }) {
  if (!points.some((p) => p.ef !== null)) return null

  const c = t.analytics.charts.efficiency
  const legend = (
    <>
      <LegendMark label={c.adjusted} />
      <LegendMark label={c.measured} dashed />
    </>
  )

  return (
    <WindowedChartCard title={c.title} legend={legend} points={points} footnote={c.footnote}>
      {(visible) => {
        const values = visible.flatMap((d) => [d.ef, d.efAdjusted]).filter((v): v is number => v !== null)
        if (!values.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const min = Math.floor(Math.min(...values) * 10) / 10 - 0.05
        const max = Math.ceil(Math.max(...values) * 10) / 10 + 0.05
        const ticks = windowTicks(visible)

        const ex = c.explains
        // The trend reads the adjusted series: a warm month is not a fitness loss.
        const trend = trendFromSeries(visible.map((d) => d.efAdjusted), 0.03)
        const explain = trend
          ? trend.direction === 'up'
            ? ex.improving(Math.abs(trend.delta).toFixed(2))
            : trend.direction === 'down'
              ? ex.declining
              : ex.stable
          : null

        const gaps = visible
          .filter((d) => d.ef !== null && d.efAdjusted !== null)
          .map((d) => d.efAdjusted! - d.ef!)
        const avgGap = gaps.length ? gaps.reduce((s, v) => s + v, 0) / gaps.length : 0
        const heatGap = avgGap >= HEAT_GAP_MIN ? ex.heatGap(avgGap.toFixed(2)) : null
        const reading = [explain, heatGap].filter(Boolean).join('. ')

        const summary = `${c.title}${reading ? `: ${reading}` : ''}`

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
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
                    dataKey="efAdjusted"
                    stroke={CHART_COLORS.efficiency}
                    strokeWidth={3}
                    fill="url(#efGradient)"
                    {...trendDots(CHART_COLORS.efficiency)}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ef"
                    stroke={CHART_COLORS.efficiency}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.65}
                    dot={false}
                    activeDot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartFigure>
            {reading && <ChartExplain text={reading} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
