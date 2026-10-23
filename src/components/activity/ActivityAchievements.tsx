import { Trophy, Medal } from 'lucide-react'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDuration, formatPace } from '@/lib/formatters'
import { cardClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const EFFORT_KM: Record<string, number> = { '1k': 1, '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }

interface Props {
  bestEfforts: Record<string, number>
  qualifiedEfforts: QualifiedEffort[]
}

export function ActivityAchievements({ bestEfforts, qualifiedEfforts }: Props) {
  if (qualifiedEfforts.length === 0) return null
  const s = t.activity.bestEfforts
  const ranked = [...qualifiedEfforts].sort((a, b) => a.rank - b.rank)

  return (
    // A record is good news, so it reads in pos: gold is the caution colour.
    <section className={cardClass({ className: 'flex flex-col gap-3' })}>
      <h3 className="text-headline text-foreground">{t.activity.achievements.title}</h3>
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
                  'bg-[var(--surface-2)]'
                )}
              >
                <Icon size={15} className={effort.rank === 1 ? 'text-[var(--pos)]' : 'text-muted-foreground'} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground">{effort.label}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {formatDuration(Math.round(seconds))}{km ? ` · ${formatPace(Math.round(seconds / km))}` : ''}
                </span>
              </div>
              <span className={cn('shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-caption font-semibold', effort.rank === 1 ? 'text-[var(--pos)]' : 'text-muted-foreground')}>
                {effort.rank === 1 ? s.prBadge : s.rankBadge(effort.rank)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
