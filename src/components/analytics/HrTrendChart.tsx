'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyHr } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  data: MonthlyHr[]
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
          name={p.dataKey === 'easyAvgHr' ? t.analytics.charts.paceTrend.easy : t.analytics.charts.paceTrend.workout}
          value={`${p.value} ${t.units.bpm}`}
        />
      ))}
    </TooltipCard>
  )
}

export function HrTrendChart({ data }: Props) {
  const values = data.flatMap((d) => [d.easyAvgHr, d.hardAvgHr]).filter((v): v is number => v !== null)
  if (!values.length) return null
  const min = Math.min(...values) - 5
  const max = Math.max(...values) + 5

  return (
    <Card accent="red" padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.hrTrend.title}</h3>
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.hrEasy }} /> {t.analytics.charts.paceTrend.easy}
          </span>
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.hr }} /> {t.analytics.charts.paceTrend.workout}
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
            domain={[min, max]}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="easyAvgHr"
            stroke={CHART_COLORS.hrEasy}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.hrEasy, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="hardAvgHr"
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
    </Card>
  )
}
