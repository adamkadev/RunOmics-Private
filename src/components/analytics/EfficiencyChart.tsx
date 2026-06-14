'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyEfficiency } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { t } from '@/i18n'

interface Props {
  data: MonthlyEfficiency[]
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
      <p className="text-sm font-semibold text-foreground">{payload[0].value.toFixed(2)} {t.analytics.charts.efficiency.unit}</p>
    </TooltipCard>
  )
}

export function EfficiencyChart({ data }: Props) {
  const values = data.map((d) => d.ef).filter((v): v is number => v !== null)
  const min = Math.floor(Math.min(...values) * 10) / 10 - 0.05
  const max = Math.ceil(Math.max(...values) * 10) / 10 + 0.05

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.efficiency.title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="efGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.efficiency} stopOpacity={0.25} />
              <stop offset="95%" stopColor={CHART_COLORS.efficiency} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="ef"
            stroke={CHART_COLORS.efficiency}
            strokeWidth={2}
            fill="url(#efGradient)"
            dot={{ r: 3, fill: CHART_COLORS.efficiency, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        {t.analytics.charts.efficiency.footnote}
      </p>
    </div>
  )
}
