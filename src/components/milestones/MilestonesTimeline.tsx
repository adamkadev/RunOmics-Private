import type { Milestone } from '@/application/usecases/GetMilestones'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDateWithYear } from '@/lib/formatters'
import { MILESTONE_ICON, MILESTONE_ICON_CLASS } from './milestoneVisuals'

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

export function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <div className="space-y-6">
      {groupByYear(milestones).map(([year, items]) => (
        <div key={year}>
          <h2 className="mb-2 px-1 text-sm font-bold text-muted-foreground">{year}</h2>
          <GlassSurface variant="card" className="p-2">
            <ul className="space-y-2">
              {items.map((m, i) => {
                const Icon = MILESTONE_ICON[m.type]
                return (
                  <li
                    key={`${m.type}-${m.date}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-foreground/[0.08] bg-foreground/[0.06]">
                      <Icon size={16} className={MILESTONE_ICON_CLASS[m.type]} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{m.label}</span>
                      <span className="block text-caption text-muted-foreground">{m.detail}</span>
                    </span>
                    <span className="shrink-0 text-caption text-subtle">{formatDateWithYear(m.date)}</span>
                  </li>
                )
              })}
            </ul>
          </GlassSurface>
        </div>
      ))}
    </div>
  )
}
