import type { Milestone } from '@/application/usecases/GetMilestones'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
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
    <li className="flex items-center gap-3 px-2 py-2.5">
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

export function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <div className="space-y-6">
      {groupByYear(milestones).map(([year, items]) => (
        <div key={year}>
          <h2 className="mb-2 px-1 text-caption font-bold uppercase tracking-[0.16em] text-subtle">{year}</h2>
          <GlassSurface variant="card" className="p-2 sm:p-3">
            <ol className="divide-y divide-foreground/[0.06]">
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
