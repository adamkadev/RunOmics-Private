'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyEfficiency } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { trendFromSeries } from '@/lib/chartTrend'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
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
  const point = payload?.[0]
  if (!active || !point) return null
  return (
    <TooltipCard label={label}>
      <p className="text-sm font-semibold text-foreground">{point.value.toFixed(2)} {t.analytics.charts.efficiency.unit}</p>
    </TooltipCard>
  )
}

export function EfficiencyChart({ data }: Props) {
  const values = data.map((d) => d.ef).filter((v): v is number => v !== null)
  const min = Math.floor(Math.min(...values) * 10) / 10 - 0.05
  const max = Math.ceil(Math.max(...values) * 10) / 10 + 0.05

  const ex = t.analytics.charts.efficiency.explains
  const trend = trendFromSeries(data.map((d) => d.ef), 0.03)
  const explain: string | null = trend
    ? trend.direction === 'up'
      ? ex.improving(Math.abs(trend.delta).toFixed(2))
      : trend.direction === 'down'
        ? ex.declining
        : ex.stable
    : null
  const summary = `${t.analytics.charts.efficiency.title}${explain ? `: ${explain}` : ''}`

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.efficiency.title}
      </h3>
      <ChartFigure summary={summary}>
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
              strokeWidth={3}
              fill="url(#efGradient)"
              dot={{ r: 3, fill: CHART_COLORS.efficiency, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
      {explain && <ChartExplain text={explain} />}
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.efficiency.footnote}
      </p>
    </GlassSurface>
  )
}
