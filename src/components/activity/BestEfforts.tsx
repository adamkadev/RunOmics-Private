import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { EFFORTS as ALL_EFFORTS } from '@/domain/activity/effort'
import { cardClass } from '@/components/ui/Card'
import { formatDuration, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const EFFORTS = ALL_EFFORTS.filter((e) => e.key !== '1mile')

interface Props {
  bestEfforts: Record<string, number>
  qualifiedEfforts?: QualifiedEffort[]
}

export function BestEfforts({ bestEfforts, qualifiedEfforts = [] }: Props) {
  const s = t.activity.bestEfforts
  const rankByKey = new Map(qualifiedEfforts.map((e) => [e.key, e.rank]))

  const entries = EFFORTS.flatMap((e) => {
    const seconds = bestEfforts[e.key]
    return seconds != null ? [{ ...e, seconds: Math.round(seconds), rank: rankByKey.get(e.key) }] : []
  })
  if (!entries.length) return null

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })}>
      <h3 className="text-headline text-foreground">{s.title}</h3>
      <div className="grid grid-cols-3 gap-2.5" data-testid="best-efforts">
        {entries.map(({ key, label, km, seconds, rank }) => (
          <div key={key} className="relative flex min-w-0 flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] px-3 py-3 sm:px-3.5">
            <span className="truncate text-xs text-muted-foreground">{s.distances[key] ?? label}</span>
            <span className="text-lg font-semibold leading-tight text-foreground sm:text-xl">{formatDuration(seconds)}</span>
            {/* A kilometre's time is its pace, so the 1 km tile says it once. */}
            {km !== 1 && <span className="truncate text-xs text-muted-foreground">{formatPace(Math.round(seconds / km))}</span>}
            {rank != null && (
              <span
                className={cn(
                  'absolute right-2.5 top-2.5 text-[11px] font-semibold leading-none',
                  rank === 1 ? 'text-[var(--pos)]' : 'text-muted-foreground',
                )}
              >
                {rank === 1 ? s.prBadge : s.rankBadge(rank)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
