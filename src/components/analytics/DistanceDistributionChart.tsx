'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { DistanceBracket } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  data: DistanceBracket[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: DistanceBracket }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipCard label={d.label}>
      <p className="text-sm font-semibold text-foreground">{t.common.runs(d.count)}</p>
      <p className="text-xs text-subtle">{t.analytics.charts.distance.kmTotal(d.km)}</p>
    </TooltipCard>
  )
}

export function DistanceDistributionChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.count))

  return (
    <Card padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.distance.title}</h3>
        <span className="text-xs text-subtle">{t.analytics.charts.distance.runs(data.reduce((s, d) => s + d.count, 0))}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={CHART_COLORS.brand}
                fillOpacity={0.45 + 0.55 * (entry.count / max)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">Color intensity reflects relative frequency.</p>
    </Card>
  )
}
