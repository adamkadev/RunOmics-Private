'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { TypeDistribution } from '@/domain/activity/types'

interface Props {
  data: TypeDistribution[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: TypeDistribution }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const config = ACTIVITY_TYPE_CONFIG[d.type]
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-900 dark:text-white">{config.label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {d.distanceKm.toFixed(1)} km · {d.percent}%
      </p>
    </div>
  )
}

export function IntensityChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
        Training Mix
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              dataKey="distanceKm"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={64}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={ACTIVITY_TYPE_CONFIG[entry.type].chartColor}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2">
          {data.map((entry) => {
            const config = ACTIVITY_TYPE_CONFIG[entry.type]
            return (
              <li key={entry.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: config.chartColor }}
                  />
                  <span className="text-gray-600 dark:text-gray-400">{config.label}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {entry.percent}%
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
