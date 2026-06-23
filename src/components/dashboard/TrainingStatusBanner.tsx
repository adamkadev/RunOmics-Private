import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { TrainingStatus, TrainingStatusType, LoadTrend } from '@/application/usecases/GetTrainingStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { STATUS } from '@/lib/statusColors'

const STATUS_STYLE: Record<TrainingStatusType, { dot: string; badge: string; text: string }> = {
  productive: {
    dot:   STATUS.success.dot,
    badge: STATUS.success.badge,
    text:  STATUS.success.text,
  },
  fresh: {
    dot:   'bg-blue-500',
    badge: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    text:  'text-blue-700 dark:text-blue-400',
  },
  overreaching: {
    dot:   'bg-red-500',
    badge: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    text:  'text-red-700 dark:text-red-400',
  },
  recovery: {
    dot:   'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    text:  'text-amber-700 dark:text-amber-400',
  },
  detraining: {
    dot:   'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    text:  'text-zinc-600 dark:text-zinc-400',
  },
}

const TREND_TONE: Record<LoadTrend, StatusTone> = {
  building:    'emerald',
  maintaining: 'zinc',
  tapering:    'blue',
  detraining:  'zinc',
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
  // C5 (validated PO, rule frozen): negative Form is a warning (amber),
  // positive/zero Form is healthy (accent). No other gradations.
  const formClass = status.tsb < 0 ? 'text-[#f0a500]' : STATUS.success.text

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
              style.dot,
              status.status === 'overreaching' && 'animate-pulse'
            )}
            aria-hidden="true"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-base font-semibold', style.text)}>
                {s.status[status.status]}
              </span>
              <StatusPill tone={TREND_TONE[status.loadTrend]}>{s.loadTrend[status.loadTrend]}</StatusPill>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 pl-5 sm:pl-0">
          <Metric label={s.metrics.fitness} value={String(status.ctl)} />
          <div className="h-8 w-px bg-foreground/10" />
          <Metric label={s.metrics.fatigue} value={String(status.atl)} />
          <div className="h-8 w-px bg-foreground/10" />
          <Metric label={s.metrics.form} value={formValue} valueClass={formClass} />
        </div>
      </div>
    </GlassSurface>
  )
}
