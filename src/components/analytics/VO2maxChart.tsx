'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { VO2maxPoint } from '@/application/usecases/GetVO2maxHistory'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

const COLOR = CHART_COLORS.efficiency // violet-500

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const s = t.dashboard.vo2maxChart
  return (
    <TooltipCard label={label}>
      <TooltipRow color={COLOR} name="VO₂max" value={`${payload[0].value.toFixed(1)} ${s.unit}`} />
    </TooltipCard>
  )
}

export function VO2maxChart({ data }: { data: VO2maxPoint[] }) {
  if (data.length < 2) return null

  const s = t.dashboard.vo2maxChart
  const values = data.map((d) => d.value)
  const min = Math.floor(Math.min(...values)) - 1
  const max = Math.ceil(Math.max(...values)) + 1

  // Show a tick every ~10 points to avoid clutter
  const step = Math.max(1, Math.floor(data.length / 6))
  const tickDates = new Set(data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => d.date))

  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length * 10) / 10

  return (
    <Card padding="lg">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {s.title}
        <span className="ml-2 font-bold tabular-nums text-violet-600 dark:text-violet-400">
          {values[values.length - 1].toFixed(1)}
          <span className="ml-1 font-normal text-muted-foreground">{s.unit}</span>
        </span>
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(d: string) => {
              if (!tickDates.has(d)) return ''
              const dt = new Date(d + 'T00:00:00')
              return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' })
            }}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={32}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <ReferenceLine y={avg} stroke={CHART_COLORS.axisTick} strokeDasharray="3 3" strokeOpacity={0.4} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={COLOR}
            strokeWidth={2}
            dot={{ r: 2.5, fill: COLOR, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </Card>
  )
}
