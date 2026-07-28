import { Trophy, Medal } from 'lucide-react'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDuration, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const EFFORT_KM: Record<string, number> = { '1k': 1, '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }

interface Props {
  bestEfforts: Record<string, number>
  qualifiedEfforts: QualifiedEffort[]
}

// Top-3 qualifying efforts only - the fuller breakdown of every distance lives in BestEfforts further down the page.
export function ActivityAchievements({ bestEfforts, qualifiedEfforts }: Props) {
  if (qualifiedEfforts.length === 0) return null
  const s = t.activity.bestEfforts
  const ranked = [...qualifiedEfforts].sort((a, b) => a.rank - b.rank)

  return (
    <GlassSurface variant="card" className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground/80">{t.activity.achievements.title}</h3>
      <div className="flex flex-col gap-2.5">
        {ranked.map((effort) => {
          const seconds = bestEfforts[effort.key]
          if (seconds == null) return null
          const km = EFFORT_KM[effort.key]
          const Icon = effort.rank === 1 ? Trophy : Medal
          return (
            <div key={effort.key} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-control',
                  effort.rank === 1 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-zinc-100 dark:bg-zinc-800/60'
                )}
              >
                <Icon size={15} className={effort.rank === 1 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground">{effort.label}</span>
                <span className="ml-1.5 text-xs text-subtle">
                  {formatDuration(Math.round(seconds))}{km ? ` · ${formatPace(Math.round(seconds / km))}` : ''}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-caption font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {effort.rank === 1 ? s.prBadge : s.rankBadge(effort.rank)}
              </span>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
