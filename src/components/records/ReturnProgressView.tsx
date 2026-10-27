import Link from 'next/link'
import { Check, Circle } from 'lucide-react'
import type { ReturnProgress } from '@/application/usecases/GetReturnProgress'
import { cardClass } from '@/components/ui/Card'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { formatDate, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

export function ReturnProgressView({ progress, today }: { progress: ReturnProgress; today: string }) {
  const r = t.returnProgress
  const now = new Date(`${today}T12:00:00`)

  return (
    <div className="space-y-4" data-testid="return-progress">
      <section className={cardClass({ className: 'space-y-1 py-3.5' })}>
        <p className="text-[13px] text-muted-foreground">{r.since(formatDate(progress.breakEnd, { now }))}</p>
        <p className="text-sm font-semibold text-foreground">{r.longest}</p>
        <p className="text-2xl font-bold tabular-nums text-foreground" data-testid="return-longest">
          {progress.longestSec > 0 ? formatDurationWords(progress.longestSec) : '—'}
        </p>
      </section>

      {progress.milestones.length > 0 && (
        <section className="space-y-2">
          <SectionDivider as="h2" className="px-0.5">{r.reached}</SectionDivider>
          <ol className={cardClass({ padding: 'none', className: 'divide-y divide-border px-3.5 py-0.5' })}>
            {progress.milestones.map((milestone) => {
              const row = (
                <>
                  <span className="flex size-[30px] items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
                    <Check className="size-4" strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">{r.milestones[milestone.key]}</span>
                  <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDate(milestone.date, { style: 'bare', now })}
                  </time>
                </>
              )
              const rowClass = 'grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 py-2.5'
              return (
                <li key={milestone.key} data-testid="return-milestone">
                  {milestone.activityId ? (
                    <Link href={`/activities/${milestone.activityId}`} className={rowClass}>{row}</Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {progress.pending.length > 0 && (
        <section className="space-y-2">
          <SectionDivider as="h2" className="px-0.5">{r.next}</SectionDivider>
          <ul className={cardClass({ padding: 'none', className: 'divide-y divide-border px-3.5 py-0.5' })}>
            {progress.pending.map((key) => (
              <li key={key} className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3 py-2.5" data-testid="return-pending">
                <span className="flex size-[30px] items-center justify-center rounded-full bg-[var(--fill-3)] text-muted-foreground" aria-hidden>
                  <Circle className="size-3.5" strokeWidth={2} />
                </span>
                <span className="min-w-0 truncate text-sm text-muted-foreground">{r.milestones[key]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
