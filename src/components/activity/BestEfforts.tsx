import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { EFFORTS as ALL_EFFORTS } from '@/domain/activity/effort'
import { formatDuration, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

// Same distances as the Records page, minus the mile: Garmin only reports it
// sporadically, so it would leave a gap in an otherwise dense row.
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
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground/80">{s.title}</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map(({ key, label, km, seconds, rank }) => {
          return (
            <div key={key} className="relative shrink-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              {rank != null && (
                <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-1.5 py-[1px] text-micro font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  {rank === 1 ? s.prBadge : s.rankBadge(rank)}
                </span>
              )}
              <p className="text-xs font-semibold text-subtle">{label}</p>
              <p className="mt-0.5 text-base font-bold tracking-tight text-foreground">{formatDuration(seconds)}</p>
              <p className="text-xs text-subtle">{formatPace(Math.round(seconds / km))}</p>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
