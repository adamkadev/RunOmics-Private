'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyEfficiency } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import type { ExplainTone } from '@/components/ui/ChartExplain'
import { trendFromSeries } from '@/lib/chartTrend'
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

  const ex = t.analytics.charts.efficiency.explains
  const trend = trendFromSeries(data.map((d) => d.ef), 0.03)
  const explain: { text: string; tone: ExplainTone } | null = trend
    ? trend.direction === 'up'
      ? { text: ex.improving(Math.abs(trend.delta).toFixed(2)), tone: 'positive' }
      : trend.direction === 'down'
        ? { text: ex.declining, tone: 'caution' }
        : { text: ex.stable, tone: 'neutral' }
    : null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.efficiency.title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
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
            width={42}
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
      {explain && <ChartExplain text={explain.text} tone={explain.tone} />}
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.efficiency.footnote}
      </p>
    </div>
  )
}
