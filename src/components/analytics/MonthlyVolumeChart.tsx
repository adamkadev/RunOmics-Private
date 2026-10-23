'use client'

import type { ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { activityTypeStyle } from '@/components/activity/activityTypeStyle'
import type { ActivityType } from '@/domain/activity/types'
import type { MonthlyVolume } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { formatDecimal, formatKm } from '@/lib/formatters'
import { monthAxis } from '@/lib/chartAxis'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartCardHead, ChartReading } from '@/components/ui/ChartCard'
import { t } from '@/i18n'

const VOLUME_STACK_ORDER: ActivityType[] = ['Base', 'Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint', 'Race']

interface Props {
  data: MonthlyVolume[]
  typesPresent: ActivityType[]
  /** The year choice, in the head of the first card it scopes. */
  controls?: ReactNode
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
    <TooltipCard label={label}>
      <p className="mb-1 text-sm font-semibold text-foreground">
        {formatDecimal(total, 1)} {t.units.km}
      </p>
      {[...payload].reverse().map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
          {p.dataKey}: {formatDecimal(p.value, 1)} {t.units.km}
        </p>
      ))}
    </TooltipCard>
  )
}

export function MonthlyVolumeChart({ data, typesPresent, controls }: Props) {
  const orderedTypes = VOLUME_STACK_ORDER.filter((type) => typesPresent.includes(type))

  const chartData = data.map((m) => ({
    label: m.label,
    ...m.byType,
  }))

  const totals = data.map((m) => m.totalKm)
  const summary = `${t.analytics.charts.monthlyVolume.title}: ${formatKm(Math.min(...totals))}–${formatKm(Math.max(...totals))} ${t.units.km}`

  const totalByType = new Map<ActivityType, number>()
  for (const m of data) {
    for (const type of orderedTypes) {
      totalByType.set(type, (totalByType.get(type) ?? 0) + (m.byType[type] ?? 0))
    }
  }
  const grandTotal = [...totalByType.values()].reduce((s, v) => s + v, 0)
  const topEntry = [...totalByType.entries()].reduce((a, b) => (b[1] > a[1] ? b : a), orderedTypes[0] ? [orderedTypes[0], 0] as [ActivityType, number] : ['Base', 0])
  const reading = grandTotal > 0
    ? t.analytics.charts.monthlyVolume.reading(t.activityTypes[topEntry[0]], Math.round((topEntry[1] / grandTotal) * 100))
    : null

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead title={t.analytics.charts.monthlyVolume.title} controls={controls} />

      {reading && <ChartReading>{reading}</ChartReading>}

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="label"
              {...monthAxis(data.length)}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              unit={` ${t.units.km}`}
              tickFormatter={(km: number) => formatKm(km)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.tooltipCursor }} />
            {orderedTypes.map((type, i) => (
              <Bar
                key={type}
                dataKey={type}
                stackId="volume"
                fill={activityTypeStyle(type).chartColor}
                // The three zone-5 types are three depths of one red, so stacked
                // adjacently they need a seam to stay countable.
                stroke="var(--card)"
                strokeWidth={0.75}
                radius={i === orderedTypes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {orderedTypes.map((type) => (
          <span key={type} className="flex items-center gap-1 text-xs text-subtle">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: activityTypeStyle(type).chartColor }}
            />
            {t.activityTypes[type]}
          </span>
        ))}
      </div>
    </GlassSurface>
  )
}
