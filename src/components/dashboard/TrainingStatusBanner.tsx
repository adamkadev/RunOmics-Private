import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { TrainingStatus, TrainingStatusType, RiskLevel, LoadTrend } from '@/application/usecases/GetTrainingStatus'

const STATUS_STYLE: Record<TrainingStatusType, { dot: string; badge: string; text: string }> = {
  productive: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  fresh: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    text: 'text-blue-700 dark:text-blue-400',
  },
  overreaching: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    text: 'text-red-700 dark:text-red-400',
  },
  recovery: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-400',
  },
  detraining: {
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    text: 'text-zinc-600 dark:text-zinc-400',
  },
}

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  moderate: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const TREND_STYLE: Record<LoadTrend, string> = {
  building: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  maintaining: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  tapering: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  detraining: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
}

function Chip({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-xl font-bold tabular-nums', valueClass ?? 'text-foreground')}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function TrainingStatusBanner({ status }: { status: TrainingStatus }) {
  const s = t.trainingStatus
  const style = STATUS_STYLE[status.status]

  const tsbSign = status.tsb >= 0 ? '+' : ''
  const formValue = `${tsbSign}${status.tsb}`
  const formClass =
    status.tsb > 5
      ? 'text-blue-600 dark:text-blue-400'
      : status.tsb < -20
        ? 'text-red-600 dark:text-red-400'
        : status.tsb < -10
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-foreground'

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left - status + description */}
        <div className="flex items-start gap-3">
          <span
            className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', style.dot)}
            aria-hidden="true"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-base font-semibold', style.text)}>
                {s.status[status.status]}
              </span>
              <Chip label={s.loadTrend[status.loadTrend]} className={TREND_STYLE[status.loadTrend]} />
              <Chip label={s.risk[status.risk]} className={RISK_STYLE[status.risk]} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {s.description[status.status]}
            </p>
          </div>
        </div>

        {/* Right - key metrics */}
        <div className="flex items-center gap-6 pl-5 sm:pl-0">
          <Metric label={s.metrics.fitness} value={String(status.ctl)} />
          <div className="h-8 w-px bg-border" />
          <Metric label={s.metrics.fatigue} value={String(status.atl)} />
          <div className="h-8 w-px bg-border" />
          <Metric label={s.metrics.form} value={formValue} valueClass={formClass} />
        </div>
      </div>

      {/* Fitness delta footnote */}
      <p className="mt-3 text-xs text-muted-foreground/70">
        {s.metrics.fitnessDelta(status.ctlDelta)}
      </p>
    </div>
  )
}
