'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { MonthlyVolume } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'

const MONTH_LABELS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

interface Props {
  currentYear: number
  currentData: MonthlyVolume[]
  prevYear: number
  prevData: MonthlyVolume[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; stroke: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={`${p.name}-${i}`} className="flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value.toFixed(1)} km</span>
        </p>
      ))}
    </div>
  )
}

export function MonthlyComparisonChart({ currentYear, currentData, prevYear, prevData }: Props) {
  // Merge into a unified 12-month array by month index
  const merged = MONTH_LABELS.map((label, i) => {
    const monthStr = String(i + 1).padStart(2, '0')
    const curr = currentData.find((d) => d.month.endsWith(`-${monthStr}`))
    const prev = prevData.find((d) => d.month.endsWith(`-${monthStr}`))
    return {
      label,
      [currentYear]: curr?.totalKm ?? 0,
      [prevYear]: prev?.totalKm ?? 0,
    }
  })

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">Month by Month</h3>
        <div className="flex items-center gap-4 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: CHART_COLORS.brand }} />
            {currentYear}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: CHART_COLORS.axisTick }} />
            {prevYear}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            unit=" km"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={currentYear}
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey={prevYear}
            stroke={CHART_COLORS.axisTick}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
