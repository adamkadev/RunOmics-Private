'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivityType } from '@/domain/activity/types'
import type { MonthlyVolume } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  data: MonthlyVolume[]
  typesPresent: ActivityType[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; fill: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mb-1 text-sm font-semibold text-foreground">
        {total.toFixed(1)} km
      </p>
      {[...payload].reverse().map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
          {p.dataKey}: {p.value.toFixed(1)} km
        </p>
      ))}
    </div>
  )
}

export function MonthlyVolumeChart({ data, typesPresent }: Props) {
  const orderedTypes = (Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]).filter((t) =>
    typesPresent.includes(t)
  )

  const chartData = data.map((m) => ({
    label: m.label,
    ...m.byType,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        Monthly Volume
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
          {orderedTypes.map((type, i) => (
            <Bar
              key={type}
              dataKey={type}
              stackId="volume"
              fill={ACTIVITY_TYPE_CONFIG[type].chartColor}
              radius={i === orderedTypes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {orderedTypes.map((type) => (
          <span key={type} className="flex items-center gap-1 text-xs text-subtle">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: ACTIVITY_TYPE_CONFIG[type].chartColor }}
            />
            {ACTIVITY_TYPE_CONFIG[type].label}
          </span>
        ))}
      </div>
    </div>
  )
}
