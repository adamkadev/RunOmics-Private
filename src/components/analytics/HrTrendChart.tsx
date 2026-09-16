'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { SparseSeries, sparseRow, type SparseRow } from '@/components/ui/SparseSeries'
import { WindowedChartCard, trendDots, windowDateAxis, windowTicks } from '@/components/ui/ChartWindowNav'
import { trendFromSeries } from '@/lib/chartTrend'
import { roundAxis } from '@/lib/chartAxis'
import { t } from '@/i18n'

// Heart rate reads in fives.
const BPM_STEP = 5

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; stroke: string; payload?: { label?: string } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={payload[0]?.payload?.label}>
      {payload.map((p) => (
        <TooltipRow
          key={p.dataKey}
          color={p.stroke}
          name={p.dataKey === 'easyAvgHr' ? t.analytics.charts.paceTrend.easy : t.analytics.charts.paceTrend.workout}
          value={`${Math.round(p.value)} ${t.units.bpm}`}
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

export function HrTrendChart({ points }: { points: WeeklyTrendPoint[] }) {
  if (!points.some((p) => p.easyAvgHr !== null || p.hardAvgHr !== null)) return null

  const legend = (
    <>
      <LegendDot color={CHART_COLORS.easy} label={t.analytics.charts.paceTrend.easy} />
      <LegendDot color={CHART_COLORS.hard} label={t.analytics.charts.paceTrend.workout} />
    </>
  )

  return (
    <WindowedChartCard
      title={t.analytics.charts.hrTrend.title}
      unit={t.units.bpm}
      legend={legend}
      points={points}
      footnote={t.analytics.charts.hrTrend.footnote}
      sparse={(visible) => (
        <SparseSeries
          count={visible.length}
          rows={
            [
              sparseRow(t.analytics.charts.paceTrend.easy, visible.map((d) => d.easyAvgHr), (v) => `${Math.round(v)} ${t.units.bpm}`),
              sparseRow(t.analytics.charts.paceTrend.workout, visible.map((d) => d.hardAvgHr), (v) => `${Math.round(v)} ${t.units.bpm}`),
            ].filter((row): row is SparseRow => row !== null)
          }
        />
      )}
    >
      {(visible) => {
        const values = visible.flatMap((d) => [d.easyAvgHr, d.hardAvgHr]).filter((v): v is number => v !== null)
        if (!values.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const axis = roundAxis(values, BPM_STEP)
        const ticks = windowTicks(visible)

        const easyVals = visible.map((d) => d.easyAvgHr).filter((v): v is number => v !== null)
        const hardVals = visible.map((d) => d.hardAvgHr).filter((v): v is number => v !== null)
        const summaryParts: string[] = []
        if (easyVals.length) summaryParts.push(`${t.analytics.charts.paceTrend.easy} ${Math.round(Math.min(...easyVals))}–${Math.round(Math.max(...easyVals))} ${t.units.bpm}`)
        if (hardVals.length) summaryParts.push(`${t.analytics.charts.paceTrend.workout} ${Math.round(Math.min(...hardVals))}–${Math.round(Math.max(...hardVals))} ${t.units.bpm}`)
        const summary = `${t.analytics.charts.hrTrend.title}: ${summaryParts.join(', ')}`

        const r = t.analytics.charts.hrTrend.reading
        const trend = trendFromSeries(easyVals, 2)
        const reading = trend
          ? trend.direction === 'down'
            ? r.down(Math.round(Math.abs(trend.delta)))
            : trend.direction === 'up'
              ? r.up(Math.round(trend.delta))
              : r.flat
          : null

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                  <XAxis {...windowDateAxis(ticks)} />
                  <YAxis
                    domain={axis?.domain}
                    ticks={axis?.ticks}
                    interval={0}
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="easyAvgHr" stroke={CHART_COLORS.easy} strokeWidth={3} {...trendDots(CHART_COLORS.easy)} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="hardAvgHr" stroke={CHART_COLORS.hard} strokeWidth={3} {...trendDots(CHART_COLORS.hard)} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartFigure>
            {reading && <ChartExplain text={reading} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
