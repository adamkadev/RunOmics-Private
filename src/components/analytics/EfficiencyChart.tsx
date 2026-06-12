'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyEfficiency } from '@/application/usecases/GetAnalyticsData'

interface Props {
  data: MonthlyEfficiency[]
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
        {payload[0].value.toFixed(2)} m/min·bpm
      </p>
    </div>
  )
}

export function EfficiencyChart({ data }: Props) {
  const values = data.map((d) => d.ef).filter((v): v is number => v !== null)
  const min = Math.floor(Math.min(...values) * 10) / 10 - 0.05
  const max = Math.ceil(Math.max(...values) * 10) / 10 + 0.05

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
        Aerobic Efficiency
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="efGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="ef"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#efGradient)"
            dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Speed per heartbeat on easy runs (m/min ÷ avg HR). Higher means better aerobic fitness.
      </p>
    </div>
  )
}
