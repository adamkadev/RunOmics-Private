import type { Milestone } from '@/application/usecases/GetMilestones'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDayMonth } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { MILESTONE_ICON, MILESTONE_ICON_CLASS, MILESTONE_NODE_CLASS } from './milestoneVisuals'

/** Milestones are already sorted newest-first; grouping preserves that order across years. */
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

function MilestoneColumn({ milestone }: { milestone: Milestone }) {
  const Icon = MILESTONE_ICON[milestone.type]
  return (
    <li className="flex w-36 shrink-0 flex-col items-center">
      <div className="flex min-h-[4.5rem] flex-col items-center justify-end px-1 text-center">
        <span className="text-sm font-bold leading-tight text-foreground">{milestone.label}</span>
        <span className="mt-0.5 text-caption leading-tight text-muted-foreground">{milestone.detail}</span>
      </div>
      <div className="relative flex h-12 w-full items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/[0.12]" aria-hidden />
        <span
          className={cn(
            'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border ring-4 ring-background',
            MILESTONE_NODE_CLASS[milestone.type]
          )}
        >
          <Icon size={15} className={MILESTONE_ICON_CLASS[milestone.type]} />
        </span>
      </div>
      <time className="mt-1.5 text-caption tabular-nums text-subtle">{formatDayMonth(milestone.date)}</time>
    </li>
  )
}

export function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <div className="space-y-6">
      {groupByYear(milestones).map(([year, items]) => (
        <div key={year}>
          <h2 className="mb-2 px-1 text-sm font-bold text-muted-foreground">{year}</h2>
          <GlassSurface variant="card" className="p-4 sm:p-6">
            <div className="overflow-x-auto pb-1">
              <ol className="flex min-w-max">
                {items.map((m, i) => (
                  <MilestoneColumn key={`${m.type}-${m.date}-${i}`} milestone={m} />
                ))}
              </ol>
            </div>
          </GlassSurface>
        </div>
      ))}
    </div>
  )
}
