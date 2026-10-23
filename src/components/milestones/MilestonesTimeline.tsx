import type { Milestone, NextMilestone } from '@/application/usecases/GetMilestones'
import { SectionDivider, EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { cardClass } from '@/components/ui/Card'
import { groupMilestonesByMonth } from '@/components/records/recordsView'
import { formatDate, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { milestoneIcon } from './milestoneVisuals'

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const { Icon, className } = milestoneIcon(milestone.type)
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
      <span
        data-testid="milestone-icon"
        className={cn('flex size-[30px] items-center justify-center rounded-full', className)}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-foreground">{milestone.label}</span>
        {milestone.detail && (
          <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">
            {milestone.detail}
          </span>
        )}
      </span>
      <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDate(milestone.date, { style: 'bare', year: 'never' })}
      </time>
    </li>
  )
}

export function NextUpCard({ next }: { next: NextMilestone[] }) {
  if (next.length === 0) return null
  return (
    <section className={cardClass({ className: 'space-y-3 py-3.5' })} data-testid="milestones-next-up">
      <h2 className={cn(EYEBROW_CLASS, 'text-accent-text')}>{t.records.milestones.nextUp}</h2>
      {next.map((m) => (
        <div key={m.kind} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold text-foreground">{m.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{t.records.milestones.toGo(formatKm(m.remaining))}</span>
          </div>
          <div
            role="progressbar"
            aria-label={m.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(m.progress * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--track)]"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, m.progress * 100)}%` }} />
          </div>
        </div>
      ))}
    </section>
  )
}

/** The month heading carries the year outside this one, so a row shows only its day. */
export function MilestonesTimeline({ milestones, today }: { milestones: Milestone[]; today: string }) {
  if (milestones.length === 0) return null
  const now = new Date(`${today}T12:00:00`)

  return (
    <div className="space-y-4">
      {groupMilestonesByMonth(milestones).map(({ key, items }) => (
        <section key={key} className="space-y-2">
          <SectionDivider as="h2" className="px-0.5">
            {formatDate(`${key}-01`, { precision: 'month', style: 'full', now })}
          </SectionDivider>
          <div className={cardClass({ padding: 'none', className: 'px-3.5 py-0.5' })}>
            <ol className="divide-y divide-border">
              {items.map((m, i) => (
                <MilestoneRow key={`${m.type}-${m.date}-${i}`} milestone={m} />
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  )
}
