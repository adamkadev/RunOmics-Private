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
import { CHART_COLORS } from '@/lib/colors'

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
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
      <p className="text-sm text-blue-500 dark:text-blue-400">Fitness {p.ctl}</p>
      <p className="text-sm text-orange-500 dark:text-orange-400">Fatigue {p.atl}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">Form {p.tsb}</p>
    </div>
  )
}

function formStatus(tsb: number): { label: string; className: string } {
  if (tsb > 5) return { label: 'Fresh', className: 'text-emerald-600 dark:text-emerald-400' }
  if (tsb >= -10) return { label: 'Neutral', className: 'text-muted-foreground' }
  if (tsb >= -30) return { label: 'Building', className: 'text-orange-500 dark:text-orange-400' }
  return { label: 'Overreaching', className: 'text-red-500 dark:text-red-400' }
}

export function TrainingLoadChart({ data }: Props) {
  const status = formStatus(data.tsb)

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">
          Training Load <span className="font-normal text-subtle">· last 90 days</span>
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-blue-500 dark:text-blue-400">
            Fitness <span className="font-semibold">{data.ctl}</span>
          </span>
          <span className="text-orange-500 dark:text-orange-400">
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
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke={CHART_COLORS.referenceLine} strokeWidth={1} />
          <Line type="monotone" dataKey="ctl" stroke={CHART_COLORS.ctl} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="atl" stroke={CHART_COLORS.atl} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="tsb" stroke={CHART_COLORS.tsb} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        Fitness = 42-day load average (CTL) · Fatigue = 7-day (ATL) · Form = Fitness − Fatigue (TSB).
      </p>
    </div>
  )
}
