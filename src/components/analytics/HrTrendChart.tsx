'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyHr } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { t } from '@/i18n'

interface Props {
  data: MonthlyHr[]
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
      <p className="text-sm font-semibold text-foreground">{payload[0].value} {t.units.bpm}</p>
    </TooltipCard>
  )
}

export function HrTrendChart({ data }: Props) {
  const values = data.map((d) => d.avgHr).filter((v): v is number => v !== null)
  if (!values.length) return null
  const min = Math.min(...values) - 5
  const max = Math.max(...values) + 5

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.hrTrend.title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="avgHr"
            stroke={CHART_COLORS.hr}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.hr, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        {t.analytics.charts.hrTrend.footnote}
      </p>
    </div>
  )
}
