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

interface Props {
  data: WeeklyVolume[]
  currentWeek: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { xLabel: string; week: number } }>
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
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{entry.xLabel || weekToMonthAbbr(entry.week)}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {value.toFixed(1)} km
      </p>
    </div>
  )
}

export function WeeklyVolumeChart({ data, currentWeek }: Props) {
  const monthLabels = data.map((entry, i) => {
    const month = weekToMonthAbbr(entry.week)
    const prev = i > 0 ? weekToMonthAbbr(data[i - 1].week) : null
    return month !== prev ? month : ''
  })

  const chartData = data.map((entry, i) => ({
    ...entry,
    xLabel: monthLabels[i],
  }))

  const currentWeekLabel = chartData.find((d) => d.week === currentWeek)?.xLabel
    ?? weekToMonthAbbr(currentWeek)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
        Weekly Volume
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="xLabel"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 3' }} />
          <ReferenceLine
            x={currentWeekLabel}
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <Area
            type="monotone"
            dataKey="distanceKm"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#volumeGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
