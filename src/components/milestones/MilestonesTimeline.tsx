import type { Milestone } from '@/application/usecases/GetMilestones'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { milestoneDotClass } from './milestoneVisuals'

function groupByYear(milestones: Milestone[]): [string, Milestone[]][] {
  const groups = new Map<string, Milestone[]>()
  for (const m of milestones) {
    const year = m.date.slice(0, 4)
    const list = groups.get(year)
    if (list) list.push(m)
    else groups.set(year, [m])
  }
  return [...groups.entries()]
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const dotClass = milestoneDotClass(milestone.type)
  return (
    <li className="flex items-center gap-3 py-2.5">
      {/* The column stays whether or not the row earns a mark, so the labels
          keep one left edge down the year. */}
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass ?? 'bg-transparent')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold leading-tight text-foreground">{milestone.label}</span>
        {milestone.detail && (
          <span className="mt-0.5 block truncate text-caption leading-tight text-muted-foreground">
            {milestone.detail}
          </span>
        )}
      </span>
      <time className="shrink-0 text-caption tabular-nums text-subtle">
        {formatDate(milestone.date, { style: 'bare', year: 'never' })}
      </time>
    </li>
  )
}

/**
 * What the gold dot means (design review, Oct 2026): marked rows beside
 * unmarked ones read as colour nobody had explained. The key sits on the
 * first year's line, as Records keys its medals beside the dots they mark.
 */
function RecordKey() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="milestone-key">
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', milestoneDotClass('record'))} />
      {t.records.milestones.recordKey}
    </p>
  )
}

export function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null
  // No mark on the page, nothing to key.
  const marked = milestones.some((m) => milestoneDotClass(m.type) !== null)

  return (
    <div className="space-y-6">
      {groupByYear(milestones).map(([year, items], i) => (
        <div key={year}>
          {/* The year and the key fade as one label under the compact bar.
              The Records tab's label and card (screen audit, Oct 2026): three
              tabs headed three ways read as three screens. */}
          <div data-bar-fade className="mb-3 flex items-center justify-between gap-3">
            <SectionDivider as="h2">{year}</SectionDivider>
            {i === 0 && marked && <RecordKey />}
          </div>
          <GlassSurface variant="card" className="px-5 py-1">
            <ol className="divide-y divide-border">
              {items.map((m, i) => (
                <MilestoneRow key={`${m.type}-${m.date}-${i}`} milestone={m} />
              ))}
            </ol>
          </GlassSurface>
        </div>
      ))}
    </div>
  )
}
