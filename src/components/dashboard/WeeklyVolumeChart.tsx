'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { WeeklyVolume } from '@/domain/activity/types'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  data: WeeklyVolume[]
  currentWeek: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: ChartEntry }>
}

interface ChartEntry extends WeeklyVolume {
  idx: number
  monthLabel: string
}

function weekToMonthAbbr(weekNum: number): string {
  const year = Math.floor(weekNum / 100)
  const week = weekNum % 100
  const jan4 = new Date(year, 0, 4)
  const dow = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7)
  return monday.toLocaleString('en', { month: 'short' }).toUpperCase().slice(0, 3)
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const { value, payload: entry } = payload[0]
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="text-xs font-medium text-muted-foreground">
        W{entry.week % 100} · {weekToMonthAbbr(entry.week)}
      </p>
      <p className="text-sm font-semibold text-foreground">{value.toFixed(1)} km</p>
    </div>
  )
}

export function WeeklyVolumeChart({ data, currentWeek }: Props) {
  const chartData: ChartEntry[] = data.map((entry, i) => {
    const month = weekToMonthAbbr(entry.week)
    const prev = i > 0 ? weekToMonthAbbr(data[i - 1].week) : null
    return { ...entry, idx: i, monthLabel: month !== prev ? month : '' }
  })

  const monthTicks = chartData.filter((d) => d.monthLabel !== '').map((d) => d.idx)
  const currentWeekIdx = chartData.findIndex((d) => d.week === currentWeek)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        Weekly Volume
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.brand} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.brand} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="idx"
            type="number"
            domain={[0, data.length - 1]}
            ticks={monthTicks}
            tickFormatter={(i: number) => chartData[i]?.monthLabel ?? ''}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.brand, strokeWidth: 1, strokeDasharray: '4 3' }} />
          {currentWeekIdx >= 0 && (
            <ReferenceLine
              x={currentWeekIdx}
              stroke={CHART_COLORS.brand}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}
          <Area
            type="monotone"
            dataKey="distanceKm"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            fill="url(#volumeGradient)"
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.brand, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
