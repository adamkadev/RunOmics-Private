'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyRpe } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { trendFromSeries } from '@/lib/chartTrend'
import { t } from '@/i18n'

interface Props {
  data: MonthlyRpe[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  const point = payload?.[0]
  if (!active || !point) return null

  return (
    <TooltipCard label={label}>
      <p className="text-sm font-semibold text-foreground">
        {t.analytics.charts.rpe.prefix} {point.value.toFixed(1)}
      </p>
    </TooltipCard>
  )
}

export function RpeTrendChart({ data }: Props) {
  const values = data
    .map((d) => d.avgRpe)
    .filter((v): v is number => v !== null)

  if (!values.length) return null

  const summary = `${t.analytics.charts.rpe.title}: ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`
  const avg = (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
  const r = t.analytics.charts.rpe.reading
  const trend = trendFromSeries(values, 0.3)
  const reading = trend ? (trend.direction === 'down' ? r.down(avg) : trend.direction === 'up' ? r.up(avg) : r.flat(avg)) : null

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.rpe.title}
      </h3>

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -4 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[2, 5]}
              ticks={[2, 3, 4, 5]}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={30}
            />

            <ReferenceLine
              y={3.5}
              stroke={CHART_COLORS.referenceLine}
              strokeDasharray="3 3"
            />

            <Tooltip content={<CustomTooltip />} />

            <Line
              type="monotone"
              dataKey="avgRpe"
              stroke={CHART_COLORS.hr}
              strokeWidth={3}
              dot={{ r: 3, fill: CHART_COLORS.hr, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>

      {reading && <ChartExplain text={reading} />}
      <p className="mt-2 text-xs text-subtle">
        {t.analytics.charts.rpe.footnote}
      </p>
    </GlassSurface>
  )
}