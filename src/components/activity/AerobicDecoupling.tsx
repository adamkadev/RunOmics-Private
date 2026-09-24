import { ChevronRight } from 'lucide-react'
import type { AerobicDecoupling as Decoupling } from '@/domain/activity/decoupling'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { formatDeltaFixed } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  decoupling: Decoupling | null
  /** Opens the Charts stack, where heart rate sits above pace and the drift is visible. */
  onShowCharts?: () => void
}

function reading(percent: number, drift: Decoupling['drift']): string {
  const r = t.activity.decoupling.reading
  if (percent < 0) return r.negative
  return drift === 'stable' ? r.stable : r.drifting
}

export function AerobicDecoupling({ decoupling, onShowCharts }: Props) {
  if (!decoupling) return null

  const { percent, drift } = decoupling
  const status = drift === 'stable' ? STATUS.success : STATUS.warning

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/80">{t.activity.decoupling.title}</span>
        <span className="flex items-center gap-1">
          <span className={cn('text-base font-extrabold tabular-nums', status.text)}>
            {formatDeltaFixed(percent, 1)}% · {t.activity.decoupling[drift]}
          </span>
          {onShowCharts && <ChevronRight size={14} className="shrink-0 text-subtle" />}
        </span>
      </div>
      <p className="mt-0.5 text-left text-caption text-subtle">{reading(percent, drift)}</p>
    </>
  )

  const surface = 'w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5'

  if (!onShowCharts) return <div className={surface}>{body}</div>

  return (
    <button
      type="button"
      onClick={onShowCharts}
      aria-label={t.activity.decoupling.seeInCharts}
      className={cn(
        surface,
        'text-left transition-colors hover:bg-foreground/[0.07]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {body}
    </button>
  )
}
