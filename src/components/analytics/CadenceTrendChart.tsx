'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyCadence } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  data: MonthlyCadence[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {payload[0].value} spm
      </p>
    </div>
  )
}

export function CadenceTrendChart({ data }: Props) {
  const values = data.map((d) => d.cadence).filter((v): v is number => v !== null)
  if (!values.length) return null
  const min = Math.floor(Math.min(...values)) - 2
  const max = Math.ceil(Math.max(...values)) + 2

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Cadence</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
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
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="cadence"
            stroke={CHART_COLORS.cadence}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.cadence, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Duration-weighted average cadence per month (steps/min).
      </p>
    </div>
  )
}
