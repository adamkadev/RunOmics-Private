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
  if (!active || !payload?.length) return null

  return (
    <TooltipCard label={label}>
      <p className="text-sm font-semibold text-foreground">
        {t.analytics.charts.rpe.prefix} {payload[0].value.toFixed(1)}
      </p>
    </TooltipCard>
  )
}

export function RpeTrendChart({ data }: Props) {
  const values = data
    .map((d) => d.avgRpe)
    .filter((v): v is number => v !== null)

  if (!values.length) return null

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.rpe.title}
      </h3>

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
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.hr, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-subtle">
        {t.analytics.charts.rpe.footnote}
      </p>
    </GlassSurface>
  )
}