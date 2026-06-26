'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { TrainingStatus, TrainingStatusType, LoadTrend } from '@/application/usecases/GetTrainingStatus'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { Tooltip } from '@/components/ui/Tooltip'
import { STATUS } from '@/lib/statusColors'
import { useCountUp } from '@/lib/useCountUp'

const STATUS_STYLE: Record<TrainingStatusType, { dot: string; badge: string; text: string; tooltip: string }> = {
  productive: {
    dot:     STATUS.success.dot,
    badge:   STATUS.success.badge,
    text:    STATUS.success.text,
    tooltip: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-700/40',
  },
  fresh: {
    dot:     STATUS.progress.dot,
    badge:   STATUS.progress.badge,
    text:    STATUS.progress.text,
    tooltip: 'bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-700/40',
  },
  overreaching: {
    dot:     STATUS.danger.dot,
    badge:   STATUS.danger.badge,
    text:    STATUS.danger.text,
    tooltip: 'bg-red-50 border-red-200 dark:bg-red-950/60 dark:border-red-700/40',
  },
  recovery: {
    dot:     STATUS.warning.dot,
    badge:   STATUS.warning.badge,
    text:    STATUS.warning.text,
    tooltip: 'bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-700/40',
  },
  detraining: {
    dot:     STATUS.pending.dot,
    badge:   STATUS.pending.badge,
    text:    STATUS.pending.text,
    tooltip: 'bg-zinc-100 border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-600/40',
  },
}

const TREND_TONE: Record<LoadTrend, StatusTone> = {
  building:    'emerald',
  maintaining: 'zinc',
  tapering:    'blue',
  detraining:  'zinc',
}

const BAR_MAX_CTL = 100
const BAR_MAX_TSB = 25

function CtlAtlBar({ value, colorClass }: { value: number; colorClass: string }) {
  const animatedValue = useCountUp(value)
  const pct = Math.min(Math.max(animatedValue / BAR_MAX_CTL, 0), 1) * 100
  return (
    <div className="h-2 w-full rounded-full bg-foreground/10">
      <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TsbBar({ value }: { value: number }) {
  const animatedValue = useCountUp(value)
  const clamped = Math.max(-BAR_MAX_TSB, Math.min(BAR_MAX_TSB, animatedValue))
  const halfPct = Math.abs(clamped / BAR_MAX_TSB) * 50
  const isPositive = value >= 0
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-foreground/10">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/20" />
      {isPositive ? (
        <div
          className="absolute inset-y-0 left-1/2 rounded-r-full bg-emerald-500"
          style={{ width: `${halfPct}%` }}
        />
      ) : (
        <div
          className="absolute inset-y-0 right-1/2 rounded-l-full bg-amber-500"
          style={{ width: `${halfPct}%` }}
        />
      )}
    </div>
  )
}

function SecondaryMetric({
  label,
  value,
  bar,
  tooltipContent,
  tooltipSurface,
}: {
  label: string
  value: ReactNode
  bar: ReactNode
  tooltipContent: string
  tooltipSurface: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1.5">
        <Tooltip content={tooltipContent} surfaceClassName={tooltipSurface}>
          <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        </Tooltip>
        <span className="text-xs font-bold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="w-full">{bar}</div>
    </div>
  )
}

export function TrainingStatusBanner({ status }: { status: TrainingStatus }) {
  const s = t.trainingStatus
  const style = STATUS_STYLE[status.status]

  const tsbSign = status.tsb >= 0 ? '+' : ''
  const animatedTsb = useCountUp(status.tsb)
  const formValue = `${tsbSign}${Math.round(animatedTsb)}`
  const isNegativeTsb = status.tsb < 0
  const formValueClass = isNegativeTsb ? STATUS.warning.text : STATUS.success.text
  const heroBox = isNegativeTsb
    ? 'border-amber-500/[0.18] bg-amber-500/[0.07]'
    : 'border-emerald-500/[0.18] bg-emerald-500/[0.07]'

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="flex flex-col gap-3">
        {/* Status row */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              style.dot,
              status.status === 'overreaching' && 'animate-pulse'
            )}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-base font-semibold', style.text)}>
              {s.status[status.status]}
            </span>
            <StatusPill tone={TREND_TONE[status.loadTrend]}>{s.loadTrend[status.loadTrend]}</StatusPill>
          </div>
        </div>

        {/* TSB hero card */}
        <Tooltip content={s.metrics.formTooltip} surfaceClassName={style.tooltip}>
          <div className={cn('rounded-[14px] border p-3', heroBox)}>
            <div className="widget-label mb-1.5 text-muted-foreground">{s.metrics.form}</div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className={cn('text-title1 font-extrabold leading-none tabular-nums', formValueClass)}>
                {formValue}
              </span>
              <span className={cn('text-xs text-right whitespace-pre-line leading-snug opacity-70', formValueClass)}>
                {s.metrics.tsbHint(status.tsb)}
              </span>
            </div>
            <TsbBar value={status.tsb} />
          </div>
        </Tooltip>

        {/* Fitness + Fatigue secondary grid */}
        <div className="grid grid-cols-2 gap-3">
          <SecondaryMetric
            label={s.metrics.fitness}
            value={<AnimatedValue value={status.ctl} />}
            tooltipContent={s.metrics.fitnessTooltip}
            tooltipSurface={style.tooltip}
            bar={<CtlAtlBar value={status.ctl} colorClass="bg-blue-500" />}
          />
          <SecondaryMetric
            label={s.metrics.fatigue}
            value={<AnimatedValue value={status.atl} />}
            tooltipContent={s.metrics.fatigueTooltip}
            tooltipSurface={style.tooltip}
            bar={<CtlAtlBar value={status.atl} colorClass="bg-amber-500" />}
          />
        </div>
      </div>
    </GlassSurface>
  )
}
