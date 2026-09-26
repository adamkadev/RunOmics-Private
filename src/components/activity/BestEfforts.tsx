import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { EFFORTS as ALL_EFFORTS } from '@/domain/activity/effort'
import { formatDuration, formatPace } from '@/lib/formatters'
import { SectionDivider } from '@/components/ui/SectionLabel'
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

  // Two or three chips in a p-5 card left most of its width empty and cost a
  // scroll. The distances are already labelled inline, so the card and its
  // heading were housing three facts that fit on one row.
  // A two-column grid under its label, not a strip that cut the 5K off at the
  // edge; and no pace beside the 1K, whose time already is its pace (G23).
  return (
    <div className="px-1">
      <SectionDivider as="p" className="mb-2">{s.title}</SectionDivider>
      <div className="grid grid-cols-2 gap-2" data-testid="best-efforts">
        {entries.map(({ key, label, km, seconds, rank }) => (
          <span
            key={key}
            className="flex min-w-0 items-baseline gap-1.5 rounded-control border border-border/60 bg-muted/30 px-2.5 py-1.5"
          >
            <span className="text-caption font-semibold text-subtle">{label}</span>
            <span className="text-sm font-bold tabular-nums tracking-tight text-foreground">{formatDuration(seconds)}</span>
            {km !== 1 && <span className="truncate text-caption tabular-nums text-subtle">{formatPace(Math.round(seconds / km))}</span>}
            {rank != null && (
              <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 text-caption font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {rank === 1 ? s.prBadge : s.rankBadge(rank)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
