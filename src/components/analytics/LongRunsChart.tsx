'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyLongRuns } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { t } from '@/i18n'

interface Props {
  data: MonthlyLongRuns[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; payload: MonthlyLongRuns }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  return (
    <TooltipCard label={label}>
      <p className="text-sm text-foreground/80">{t.analytics.charts.longRuns.range1015}: {entry.km10}</p>
      <p className="text-sm text-foreground/80">{t.analytics.charts.longRuns.range15}: {entry.km15}</p>
    </TooltipCard>
  )
}

export function LongRunsChart({ data }: Props) {
  if (!data.some((d) => d.km10 > 0 || d.km15 > 0)) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">{t.analytics.charts.longRuns.title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
          <Bar dataKey="km10" stackId="lr" fill={CHART_COLORS.longRun10} radius={[0, 0, 0, 0]} />
          <Bar dataKey="km15" stackId="lr" fill={CHART_COLORS.longRun15} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: '#6ee7b7' }} />
          {t.analytics.charts.longRuns.range1015}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: '#059669' }} />
          {t.analytics.charts.longRuns.range15}
        </span>
      </div>
    </div>
  )
}
