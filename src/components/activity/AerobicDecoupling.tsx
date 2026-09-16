import type { AerobicDecoupling as Decoupling } from '@/domain/activity/decoupling'
import { ChartCardHead } from '@/components/ui/ChartCard'
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
      {/* The card used to explain itself twice: a line on what happened, then a
          line on how the ratio is computed. The method is reference material,
          so it goes behind the same disclosure the chart cards use for theirs. */}
      <ChartCardHead
        className="mb-1.5"
        title={t.activity.decoupling.title}
        footnote={t.activity.decoupling.footnote}
        controls={
          <p className={cn('text-base font-extrabold tabular-nums', status.text)}>
            {percent > 0 ? '+' : ''}{percent.toFixed(1)}% · {t.activity.decoupling[drift]}
          </p>
        }
      />
      <p className="text-caption text-subtle">{reading(percent, drift)}</p>
    </div>
  )
}
