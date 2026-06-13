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
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">Easy (Z1–Z2): {entry.easyPct}%</p>
      <p className="text-sm text-orange-500 dark:text-orange-400">Hard (Z3+): {entry.hardPct}%</p>
    </div>
  )
}

export function EasyHardChart({ data }: Props) {
  if (!data.some((d) => d.easyPct !== null)) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
        Easy / Hard Split
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
          <Bar dataKey="easyPct" stackId="eh" fill="#34d399" />
          <Bar dataKey="hardPct" stackId="eh" fill="#fb923c" radius={[3, 3, 0, 0]} />
          <ReferenceLine y={80} stroke="#6b7280" strokeDasharray="4 3" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Share of time in Z1–Z2 vs Z3+ per month. Dashed line = 80/20 target.
      </p>
    </div>
  )
}
