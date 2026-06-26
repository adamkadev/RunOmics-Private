'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyCadence } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  data: MonthlyCadence[]
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
      <p className="text-sm font-semibold text-foreground">{payload[0].value} {t.analytics.charts.cadence.unit}</p>
    </TooltipCard>
  )
}

export function CadenceTrendChart({ data }: Props) {
  const values = data.map((d) => d.cadence).filter((v): v is number => v !== null)
  if (!values.length) return null
  const min = Math.floor(Math.min(...values)) - 2
  const max = Math.ceil(Math.max(...values)) + 2

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">{t.analytics.charts.cadence.title}</h3>
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
            dataKey="cadence"
            stroke={CHART_COLORS.cadence}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.cadence, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        {t.analytics.charts.cadence.footnote}
      </p>
    </GlassSurface>
  )
}
