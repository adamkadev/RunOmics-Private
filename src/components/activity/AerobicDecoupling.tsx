import type { AerobicDecoupling as Decoupling } from '@/domain/activity/decoupling'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  decoupling: Decoupling | null
}

function reading(percent: number, drift: Decoupling['drift']): string {
  const r = t.activity.decoupling.reading
  if (percent < 0) return r.negative
  return drift === 'stable' ? r.stable : r.drifting
}

export function AerobicDecoupling({ decoupling }: Props) {
  if (!decoupling) return null

  const { percent, drift } = decoupling
  const status = drift === 'stable' ? STATUS.success : STATUS.warning

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{t.activity.decoupling.title}</p>
        <p className={cn('text-base font-extrabold tabular-nums', status.text)}>
          {percent > 0 ? '+' : ''}{percent.toFixed(1)}% · {t.activity.decoupling[drift]}
        </p>
      </div>
      <p className="mt-1.5 text-caption text-subtle">{reading(percent, drift)}</p>
      <p className="mt-1 text-micro text-subtle-2">{t.activity.decoupling.footnote}</p>
    </div>
  )
}
