'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyRunningForm } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { t } from '@/i18n'

type Metric = 'groundContact' | 'verticalOscillation' | 'strideLength'

const METRICS: Metric[] = ['groundContact', 'verticalOscillation', 'strideLength']

const DATA_KEY: Record<Metric, keyof MonthlyRunningForm> = {
  groundContact: 'groundContactMs',
  verticalOscillation: 'verticalOscillationMm',
  strideLength: 'strideLengthM',
}

const COLOR: Record<Metric, string> = {
  groundContact: CHART_COLORS.groundContact,
  verticalOscillation: CHART_COLORS.verticalOscillation,
  strideLength: CHART_COLORS.strideLength,
}

const ACTIVE_PILL_CLASS: Record<Metric, string> = {
  groundContact: 'bg-amber-500 text-white',
  verticalOscillation: 'bg-rose-500 text-white',
  strideLength: 'bg-teal-500 text-white',
}

const UNIT_BY_KEY: Record<string, string> = {
  groundContactMs: t.analytics.charts.runningForm.unit.groundContact,
  verticalOscillationMm: t.analytics.charts.runningForm.unit.verticalOscillation,
  strideLengthM: t.analytics.charts.runningForm.unit.strideLength,
}

interface Props {
  data: MonthlyRunningForm[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <TooltipCard label={label}>
      <p className="text-sm font-semibold text-foreground">{p.value} {UNIT_BY_KEY[p.dataKey]}</p>
    </TooltipCard>
  )
}

export function RunningFormChart({ data }: Props) {
  const available = METRICS.filter((m) => data.some((d) => d[DATA_KEY[m]] !== null))
  const [metric, setMetric] = useState<Metric | null>(available[0] ?? null)
  if (!metric) return null

  const key = DATA_KEY[metric]
  const color = COLOR[metric]
  const values = data.map((d) => d[key]).filter((v): v is number => v !== null)
  const min = Math.floor(Math.min(...values) * 0.97)
  const max = Math.ceil(Math.max(...values) * 1.03)

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.runningForm.title}</h3>
        <div className="flex gap-1">
          {available.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                m === metric ? ACTIVE_PILL_CLASS[m] : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.analytics.charts.runningForm.metrics[m]}
            </button>
          ))}
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
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        {t.analytics.charts.runningForm.footnote[metric]}
      </p>
    </div>
  )
}
