'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TrainingLoadData, TrainingLoadPoint } from '@/application/usecases/GetTrainingLoad'

interface Props {
  data: TrainingLoadData
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: TrainingLoadPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{p.label}</p>
      <p className="text-sm text-blue-500">Fitness {p.ctl}</p>
      <p className="text-sm text-orange-500">Fatigue {p.atl}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">Form {p.tsb}</p>
    </div>
  )
}

function formStatus(tsb: number): { label: string; className: string } {
  if (tsb > 5) return { label: 'Fresh', className: 'text-emerald-600 dark:text-emerald-400' }
  if (tsb >= -10) return { label: 'Neutral', className: 'text-gray-500 dark:text-gray-400' }
  if (tsb >= -30) return { label: 'Building', className: 'text-orange-500 dark:text-orange-400' }
  return { label: 'Overreaching', className: 'text-red-500 dark:text-red-400' }
}

export function TrainingLoadChart({ data }: Props) {
  const status = formStatus(data.tsb)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Training Load <span className="font-normal text-gray-400">· last 90 days</span>
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-blue-500">
            Fitness <span className="font-semibold">{data.ctl}</span>
          </span>
          <span className="text-orange-500">
            Fatigue <span className="font-semibold">{data.atl}</span>
          </span>
          <span className={status.className}>
            Form <span className="font-semibold">{data.tsb}</span> · {status.label}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data.points} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
          <Line type="monotone" dataKey="ctl" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="tsb" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Fitness = 42-day load average (CTL) · Fatigue = 7-day (ATL) · Form = Fitness − Fatigue (TSB).
      </p>
    </div>
  )
}
