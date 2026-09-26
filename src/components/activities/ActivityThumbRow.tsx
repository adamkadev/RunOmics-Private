import Link from 'next/link'
import { PrBadge } from './PrBadge'
import { RouteThumb } from '@/components/ui/RouteThumb'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatClock, formatDistance, formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
  /** 56 pt on Today (M7), 52 pt in the Activities week card (M8). */
  size?: 52 | 56
  /** "Thu 24" under a week heading, "Thu" on Today where the week is implied. */
  withDay?: boolean
}

/**
 * A run as a flat row: its route, what it was, when and how hard, then the
 * distance over the pace. Rows sit inside one card and the card draws the
 * dividers (ThumbRowList).
 */
export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], size = 52, withDay = false }: Props) {
  const title = a.description || t.activity.runTitle(a.dayOfWeek)
  const subtitle = [formatWeekday(a.date, withDay), a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/activities/${a.id}`}
      data-testid="thumb-row"
      className="flex items-center gap-3 py-2.5 pr-4 pl-2.5 transition-opacity active:opacity-70"
    >
      <RouteThumb path={a.routeThumb} type={a.type} size={size} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex items-center gap-1.5">
          <span className={size === 56 ? 'truncate font-display text-base font-semibold leading-tight text-foreground' : 'truncate font-display text-subhead font-semibold leading-tight text-foreground'}>
            {title}
          </span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="truncate text-footnote text-muted-foreground">{subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.75">
        <span className={size === 56 ? 'font-display text-[17px] font-bold leading-none text-foreground' : 'font-display text-base font-bold leading-none text-foreground'}>
          {formatDistance(a.distanceKm)} <span className="text-caption font-normal text-muted-foreground">{t.units.km}</span>
        </span>
        {a.paceSecPerKm !== null && (
          <span className="text-footnote tabular-nums text-muted-foreground">{formatClock(a.paceSecPerKm)}</span>
        )}
      </span>
    </Link>
  )
}

/** Rows in one card, divided under the text, not under the thumbnails. */
export function ThumbRowDivider({ size = 52 }: { size?: 52 | 56 }) {
  return <div aria-hidden="true" className="h-px bg-border" style={{ marginLeft: size + 22 }} />
}
