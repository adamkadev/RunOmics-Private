'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { MonthlyEasyHard } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  data: MonthlyEasyHard[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: MonthlyEasyHard }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">Easy (Z1–Z2): {entry.easyPct}%</p>
      <p className="text-sm text-orange-500 dark:text-orange-400">Hard (Z3+): {entry.hardPct}%</p>
    </div>
  )
}

export function EasyHardChart({ data }: Props) {
  if (!data.some((d) => d.easyPct !== null)) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        Easy / Hard Split
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
          <Bar dataKey="easyPct" stackId="eh" fill={CHART_COLORS.easy} />
          <Bar dataKey="hardPct" stackId="eh" fill={CHART_COLORS.hard} radius={[3, 3, 0, 0]} />
          <ReferenceLine y={80} stroke={CHART_COLORS.referenceTarget} strokeDasharray="4 3" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        Share of time in Z1–Z2 vs Z3+ per month. Dashed line = 80/20 target.
      </p>
    </div>
  )
}
