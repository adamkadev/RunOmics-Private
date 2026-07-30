'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { WindowedChartCard, trendDots, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { trendFromSeries } from '@/lib/chartTrend'
import { t } from '@/i18n'

type Metric = 'cadence' | 'groundContact' | 'verticalOscillation' | 'verticalRatio' | 'strideLength'

const METRICS: Metric[] = ['cadence', 'groundContact', 'verticalOscillation', 'verticalRatio', 'strideLength']

const DATA_KEY: Record<Metric, keyof WeeklyTrendPoint> = {
  cadence: 'cadenceSpm',
  groundContact: 'groundContactMs',
  verticalOscillation: 'verticalOscillationMm',
  verticalRatio: 'verticalRatioPct',
  strideLength: 'strideLengthM',
}

const COLOR: Record<Metric, string> = {
  cadence: CHART_COLORS.cadence,
  groundContact: CHART_COLORS.groundContact,
  verticalOscillation: CHART_COLORS.verticalOscillation,
  verticalRatio: CHART_COLORS.verticalRatio,
  strideLength: CHART_COLORS.strideLength,
}

const ACTIVE_PILL_CLASS: Record<Metric, string> = {
  cadence: 'bg-sky-500 text-white',
  groundContact: 'bg-amber-500 text-white',
  verticalOscillation: 'bg-rose-500 text-white',
  verticalRatio: 'bg-fuchsia-500 text-white',
  strideLength: 'bg-teal-500 text-white',
}

const UNIT_BY_KEY: Record<string, string> = {
  cadenceSpm: t.analytics.charts.runningForm.unit.cadence ?? '',
  groundContactMs: t.analytics.charts.runningForm.unit.groundContact ?? '',
  verticalOscillationMm: t.analytics.charts.runningForm.unit.verticalOscillation ?? '',
  verticalRatioPct: t.analytics.charts.runningForm.unit.verticalRatio ?? '',
  strideLengthM: t.analytics.charts.runningForm.unit.strideLength ?? '',
}

// Below this much movement the metric is called steady rather than trending:
// one weekly point of noise should not read as a change in form.
const FLAT_THRESHOLD: Record<Metric, number> = {
  cadence: 1,
  groundContact: 3,
  verticalOscillation: 0.3,
  verticalRatio: 0.2,
  strideLength: 0.02,
}

const TICK_DECIMALS: Record<Metric, number> = {
  cadence: 0,
  groundContact: 0,
  verticalOscillation: 1,
  verticalRatio: 1,
  strideLength: 2,
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload?: { label?: string } }>
  decimals: number
}

function CustomTooltip({ active, payload, decimals }: TooltipProps) {
  const p = payload?.[0]
  if (!active || !p) return null
  return (
    <TooltipCard label={p.payload?.label}>
      <p className="text-sm font-semibold text-foreground">{p.value.toFixed(decimals)} {UNIT_BY_KEY[p.dataKey]}</p>
    </TooltipCard>
  )
}

export function RunningFormChart({ points }: { points: WeeklyTrendPoint[] }) {
  // Availability is judged over the whole history, not the visible window, so
  // the metric pills stay stable while paging.
  const available = METRICS.filter((m) => points.some((p) => p[DATA_KEY[m]] !== null))
  const [metric, setMetric] = useState<Metric>(available[0] ?? 'cadence')
  if (!available.length) return null

  const active = available.includes(metric) ? metric : available[0]!
  const key = DATA_KEY[active]
  const color = COLOR[active]
  const decimals = TICK_DECIMALS[active]

  const controls = (
    <div className="flex flex-wrap gap-1">
      {available.map((m) => (
        <button
          key={m}
          onClick={() => setMetric(m)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
            m === active
              ? `${ACTIVE_PILL_CLASS[m]} font-semibold shadow-sm`
              : 'border border-foreground/[0.12] bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/[0.10] hover:text-foreground'
          }`}
        >
          {t.analytics.charts.runningForm.metrics[m]}
        </button>
      ))}
    </div>
  )

  return (
    <WindowedChartCard
      title={t.analytics.charts.runningForm.title}
      controls={controls}
      points={points}
      footnote={t.analytics.charts.runningForm.footnote[active]}
    >
      {(visible) => {
        const values = visible.map((d) => d[key]).filter((v): v is number => typeof v === 'number')
        if (!values.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const min = Math.min(...values) * 0.97
        const max = Math.max(...values) * 1.03
        const ticks = windowTicks(visible)
        const lo = Math.min(...values).toFixed(decimals)
        const hi = Math.max(...values).toFixed(decimals)
        const metric = t.analytics.charts.runningForm.metrics[active]!
        const summary = `${t.analytics.charts.runningForm.title}: ${metric} ${lo}–${hi} ${UNIT_BY_KEY[key]}`
        const trend = trendFromSeries(values, FLAT_THRESHOLD[active])
        const r = t.analytics.charts.runningForm.reading
        const reading =
          !trend || trend.direction === 'flat'
            ? r.flat(metric)
            : r[trend.direction](metric, Math.abs(trend.delta).toFixed(decimals), UNIT_BY_KEY[key] ?? '')

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
                    tickFormatter={(v: number) => v.toFixed(decimals)}
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip decimals={decimals} />} />
                  <Line
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={3}
                    {...trendDots(color)}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartFigure>
            <ChartExplain text={reading} />
          </>
        )
      }}
    </WindowedChartCard>
  )
}
