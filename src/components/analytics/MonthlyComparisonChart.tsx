'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyVolume } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentColor } from '@/lib/useAccent'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

const MONTH_LABELS = t.dashboard.heatmap.months.map((m) => m.toUpperCase())

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
    <TooltipCard label={label}>
      {payload.map((p, i) => (
        <TooltipRow
          key={`${p.name}-${i}`}
          color={p.stroke}
          name={p.name}
          value={`${p.value.toFixed(1)} ${t.units.km}`}
        />
      ))}
    </TooltipCard>
  )
}

export function MonthlyComparisonChart({ currentYear, currentData, prevYear, prevData }: Props) {
  const accentColor = useAccentColor()
  // Merge into a unified 12-month array by month index
  const merged = MONTH_LABELS.map((label, i) => {
    const monthStr = String(i + 1).padStart(2, '0')
    const curr = currentData.find((d) => d.month.endsWith(`-${monthStr}`))
    const prev = prevData.find((d) => d.month.endsWith(`-${monthStr}`))
    return {
      label,
      [currentYear]: curr?.totalKm ?? null,
      [prevYear]: prev?.totalKm ?? null,
    }
  })

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.monthlyComparison.title}</h3>
        <div className="flex items-center gap-4 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: accentColor }} />
            {currentYear}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: CHART_COLORS.axisTick }} />
            {prevYear}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
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
            stroke={accentColor}
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
    </GlassSurface>
  )
}
