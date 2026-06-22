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
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

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
    <TooltipCard label={p.label}>
      <p className="text-sm text-blue-500 dark:text-blue-400">{t.dashboard.trainingLoad.fitness} {p.ctl}</p>
      <p className="text-sm text-orange-500 dark:text-orange-400">{t.dashboard.trainingLoad.fatigue} {p.atl}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.dashboard.trainingLoad.form} {p.tsb}</p>
    </TooltipCard>
  )
}

function formStatus(tsb: number): { label: string; className: string } {
  const s = t.dashboard.trainingLoad.status
  if (tsb > 5) return { label: s.fresh, className: 'text-emerald-600 dark:text-emerald-400' }
  if (tsb >= -10) return { label: s.neutral, className: 'text-muted-foreground' }
  if (tsb >= -30) return { label: s.building, className: 'text-orange-500 dark:text-orange-400' }
  return { label: s.overreaching, className: 'text-red-500 dark:text-red-400' }
}

export function TrainingLoadChart({ data }: Props) {
  const status = formStatus(data.tsb)

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.dashboard.trainingLoad.title} <span className="font-normal text-subtle">{t.dashboard.trainingLoad.window}</span>
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-blue-500 dark:text-blue-400">
            {t.dashboard.trainingLoad.fitness} <span className="font-semibold">{data.ctl}</span>
          </span>
          <span className="text-orange-500 dark:text-orange-400">
            {t.dashboard.trainingLoad.fatigue} <span className="font-semibold">{data.atl}</span>
          </span>
          <span className={status.className}>
            {t.dashboard.trainingLoad.form} <span className="font-semibold">{data.tsb}</span> · {status.label}
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
        {t.dashboard.trainingLoad.footnote}
      </p>
    </GlassSurface>
  )
}
