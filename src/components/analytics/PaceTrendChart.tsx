'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyPace } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import type { ExplainTone } from '@/components/ui/ChartExplain'
import { trendFromSeries } from '@/lib/chartTrend'
import { formatClock } from '@/lib/formatters'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  data: MonthlyPace[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; stroke: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={label}>
      {payload.map((p) => (
        <TooltipRow
          key={p.dataKey}
          color={p.stroke}
          name={p.dataKey === 'easyPace' ? t.analytics.charts.paceTrend.easy : t.analytics.charts.paceTrend.workout}
          value={`${formatClock(p.value)} /${t.units.km}`}
        />
      ))}
    </TooltipCard>
  )
}

export function PaceTrendChart({ data }: Props) {
  const paces = data.flatMap((d) => [d.easyPace, d.hardPace]).filter((p): p is number => p !== null)
  const minPace = Math.min(...paces) - 10
  const maxPace = Math.max(...paces) + 10

  // Pace in sec/km: lower = faster = better, so "down" is positive
  const ex = t.analytics.charts.paceTrend.explains
  const trend = trendFromSeries(data.map((d) => d.easyPace), 8)
  const explain: { text: string; tone: ExplainTone } | null = trend
    ? trend.direction === 'down'
      ? { text: ex.improving(Math.abs(Math.round(trend.delta))), tone: 'positive' }
      : trend.direction === 'up'
        ? { text: ex.slowing(Math.round(trend.delta)), tone: 'caution' }
        : { text: ex.stable, tone: 'neutral' }
    : null

  return (
    <Card accent="amber" padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.paceTrend.title}</h3>
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t.analytics.charts.paceTrend.easy}
          </span>
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> {t.analytics.charts.paceTrend.workout}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minPace, maxPace]}
            reversed
            tickFormatter={formatClock}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="easyPace"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.brand, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="hardPace"
            stroke={CHART_COLORS.atl}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.atl, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {explain && <ChartExplain text={explain.text} tone={explain.tone} />}
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.paceTrend.footnote}
      </p>
    </Card>
  )
}
