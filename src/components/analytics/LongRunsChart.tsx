'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { MonthlyLongRuns } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentColor } from '@/lib/useAccent'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  data: MonthlyLongRuns[]
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
        {t.analytics.charts.longRuns.kmLabel(payload[0].value)}
      </p>
    </TooltipCard>
  )
}

export function LongRunsChart({ data }: Props) {
  const accentColor = useAccentColor()
  const nonZero = data.filter((d) => d.longestKm > 0)
  if (nonZero.length === 0) return null

  const avg = Math.round(nonZero.reduce((s, d) => s + d.longestKm, 0) / nonZero.length)
  const explain =
    avg >= 15
      ? { text: t.analytics.charts.longRuns.explains.good(avg), tone: 'positive' as const }
      : { text: t.analytics.charts.longRuns.explains.low(avg), tone: 'caution' as const }

  return (
    <Card padding="lg">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">{t.analytics.charts.longRuns.title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            unit=" km"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.tooltipCursor }} />
          <ReferenceLine
            y={15}
            stroke={CHART_COLORS.referenceTarget}
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: t.analytics.charts.longRuns.refLine, position: 'insideTopRight', fontSize: 10, fill: CHART_COLORS.referenceTarget }}
          />
          <Bar
            dataKey="longestKm"
            fill={accentColor}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <ChartExplain text={explain.text} tone={explain.tone} />
    </Card>
  )
}
