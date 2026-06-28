'use client'

import {
  LineChart,
  Line,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TrainingLoadData, TrainingLoadPoint } from '@/application/usecases/GetTrainingLoad'
import { CHART_COLORS } from '@/lib/colors'
import { STATUS } from '@/lib/statusColors'
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

function EndLabel({ x, y, value, index, lastIndex, text, color }: {
  x?: string | number
  y?: string | number
  value?: string | number | boolean | null
  index?: number
  lastIndex: number
  text: string
  color: string
}) {
  if (index !== lastIndex) return null
  return (
    <text x={Number(x ?? 0) + 6} y={y} dy={4} fontSize={11} fontWeight={600} fill={color}>
      {text} {value}
    </text>
  )
}

function formStatus(tsb: number): { label: string; className: string } {
  const s = t.dashboard.trainingLoad.status
  if (tsb > 5)   return { label: s.fresh,       className: STATUS.success.text }
  if (tsb >= -10) return { label: s.neutral,     className: 'text-muted-foreground' }
  if (tsb >= -30) return { label: s.building,    className: STATUS.warning.text }
  return           { label: s.overreaching,       className: STATUS.danger.text }
}

export function TrainingLoadChart({ data }: Props) {
  const status = formStatus(data.tsb)
  const lastIndex = data.points.length - 1

  return (
    <GlassSurface variant="card" className="p-5">
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
        <LineChart data={data.points} margin={{ top: 4, right: 56, bottom: 0, left: -20 }}>
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
          <Line type="monotone" dataKey="ctl" stroke={CHART_COLORS.ctl} strokeWidth={2} dot={false} isAnimationActive={false}>
            <LabelList dataKey="ctl" content={(props: { x?: string | number; y?: string | number; value?: string | number | boolean | null; index?: number }) => (
              <EndLabel x={props.x} y={props.y} value={props.value} index={props.index} lastIndex={lastIndex} text={t.dashboard.trainingLoad.fitness} color={CHART_COLORS.ctl} />
            )} />
          </Line>
          <Line type="monotone" dataKey="atl" stroke={CHART_COLORS.atl} strokeWidth={1.5} dot={false} isAnimationActive={false}>
            <LabelList dataKey="atl" content={(props: { x?: string | number; y?: string | number; value?: string | number | boolean | null; index?: number }) => (
              <EndLabel x={props.x} y={props.y} value={props.value} index={props.index} lastIndex={lastIndex} text={t.dashboard.trainingLoad.fatigue} color={CHART_COLORS.atl} />
            )} />
          </Line>
          <Line type="monotone" dataKey="tsb" stroke={CHART_COLORS.tsb} strokeWidth={1.5} dot={false} isAnimationActive={false}>
            <LabelList dataKey="tsb" content={(props: { x?: string | number; y?: string | number; value?: string | number | boolean | null; index?: number }) => (
              <EndLabel x={props.x} y={props.y} value={props.value} index={props.index} lastIndex={lastIndex} text={t.dashboard.trainingLoad.form} color={CHART_COLORS.tsb} />
            )} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-subtle">
        {t.dashboard.trainingLoad.footnote}
      </p>
    </GlassSurface>
  )
}
