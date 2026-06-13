'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyPace } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  data: MonthlyPace[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; stroke: string }>
  label?: string
}

function formatPaceTick(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
          <span className="text-muted-foreground">
            {p.dataKey === 'easyPace' ? 'Easy' : 'Workout'}:
          </span>
          <span className="font-semibold text-foreground">
            {formatPaceTick(p.value)} /km
          </span>
        </p>
      ))}
    </div>
  )
}

export function PaceTrendChart({ data }: Props) {
  const paces = data.flatMap((d) => [d.easyPace, d.hardPace]).filter((p): p is number => p !== null)
  const minPace = Math.min(...paces) - 10
  const maxPace = Math.max(...paces) + 10

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">Pace Trend</h3>
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Easy
          </span>
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> Workout
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minPace, maxPace]}
            reversed
            tickFormatter={formatPaceTick}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={42}
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
      <p className="mt-2 text-xs text-subtle">
        Distance-weighted average pace per month. Lower is faster.
      </p>
    </div>
  )
}
