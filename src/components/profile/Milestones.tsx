import { Trophy, Flame, Milestone as MilestoneIcon } from 'lucide-react'
import type { Milestone, MilestoneType } from '@/application/usecases/GetMilestones'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'

const ICON: Record<MilestoneType, typeof Trophy> = {
  'distance-tier': MilestoneIcon,
  streak: Flame,
  record: Trophy,
}

const ICON_CLASS: Record<MilestoneType, string> = {
  'distance-tier': 'text-blue-500 dark:text-blue-400',
  streak: 'text-orange-500 dark:text-orange-400',
  record: 'text-amber-500 dark:text-amber-400',
}

export function Milestones({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <GlassSurface variant="card" className="p-5">
      <h2 className="mb-3 text-sm font-bold text-foreground">{t.profile.milestones.title}</h2>

      <ul className="space-y-2">
        {milestones.map((m, i) => {
          const Icon = ICON[m.type]
          return (
            <li
              key={`${m.type}-${m.date}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-foreground/[0.08] bg-foreground/[0.06]">
                <Icon size={16} className={ICON_CLASS[m.type]} />
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
  )
}
