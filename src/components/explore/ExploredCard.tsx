import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { isComplete, type ExploredSummary } from '@/domain/explore/summary'
import { cardClass } from '@/components/ui/Card'
import { formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { districtsHref } from './exploreHref'

// The same press as ProgressHub's LINK_CARD.
const LINK_CARD = 'text-left transition-transform duration-100 ease-out active:scale-[0.98]'
const PARTIAL_FILL = 'color-mix(in srgb, var(--accent) 60%, transparent)'
/** More units than this read as one continuous bar: dozens of 3 px slivers say nothing. */
const MAX_SEGMENTS = 24

function SegmentBar({ summary }: { summary: ExploredSummary }) {
  if (summary.segments.length > MAX_SEGMENTS) {
    return (
      <div className="relative h-2 overflow-hidden rounded-[4px] bg-[var(--track)]" aria-hidden="true" data-testid="explored-bar">
        <div className="absolute inset-y-0 left-0 rounded-[4px] bg-accent" style={{ width: `${summary.pct}%` }} />
      </div>
    )
  }
  return (
    <div className="flex h-2 gap-1" aria-hidden="true" data-testid="explored-bar">
      {summary.segments.map((pct, i) => {
        // Complete reads whole, even at 96%.
        const complete = isComplete(pct)
        return (
          <span
            key={i}
            data-testid="explored-segment"
            data-complete={complete ? '' : undefined}
            className="relative min-w-0 flex-1 overflow-hidden rounded-[4px] bg-[var(--track)]"
          >
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${complete ? 100 : pct}%`, background: complete ? 'var(--accent)' : PARTIAL_FILL }}
            />
          </span>
        )
      })}
    </div>
  )
}

/** Two sibling links, never one inside the other. Worked out on the server, so it paints whole at once. */
export interface OtherArea {
  id: string
  name: string
  summary: ExploredSummary
}

/** The area run in last; the others each a row that opens its map. */
export function ExploredCard({ areaId, areaName, summary, others = [] }: { areaId: string; areaName: string; summary: ExploredSummary; others?: readonly OtherArea[] }) {
  const h = t.profile.hub
  const next = summary.next
  const nextParts = next ? h.exploredNext(next.name, formatPercent(next.pct)) : null

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="explored-card">
      <Link href={districtsHref(null, areaId)} prefetch={false} className={cn('flex flex-col gap-3', LINK_CARD)} data-testid="explored-open">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-headline text-foreground">{h.explored}</span>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{areaName}</span>
        </div>
        <p className="flex h-12 min-w-0 items-baseline gap-2.5">
          <span className="shrink-0 text-[44px] font-bold leading-[48px] tracking-[-0.02em] tabular-nums text-foreground" data-testid="explored-pct">
            {formatPercent(summary.pct)}
          </span>
          <span className="min-w-0 truncate text-[15px] text-muted-foreground" data-testid="explored-complete">
            {h.exploredComplete(summary.complete, summary.total)}
          </span>
        </p>
        <SegmentBar summary={summary} />
      </Link>
      <Link
        href={districtsHref(next?.id, areaId)}
        prefetch={false}
        className={cn('flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[15px] leading-[22px]', LINK_CARD)}
        data-testid="explored-next"
      >
        <span className="min-w-0 truncate text-muted-foreground">
          {nextParts ? (
            <>
              {nextParts.lead}
              <b className="font-semibold text-foreground">{nextParts.name}</b>
              {nextParts.tail}
            </>
          ) : (
            h.exploredAllComplete(summary.total)
          )}
        </span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </Link>
      {others.map((other) => (
        <Link
          key={other.id}
          href={districtsHref(null, other.id)}
          prefetch={false}
          className={cn('flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[15px] leading-[22px]', LINK_CARD)}
          data-testid="explored-other"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            <b className="font-semibold text-foreground">{other.name}</b> · {t.pages.map.districts.sheet.explored(formatPercent(other.summary.pct))}
          </span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </section>
  )
}
