import Link from 'next/link'
import { PrBadge } from './PrBadge'
import { RouteThumb } from '@/components/ui/RouteThumb'
import { TypeDot } from '@/components/ui/TypeDot'
import { Unit } from '@/components/ui/Stat'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDate, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
  /**
   * `card`: a row of a list card, divided by the card (Today's recent runs,
   * a list sorted by something other than date). `inset`: a rounded row
   * inside an open Activities week, under its month's heading, so its date
   * leaves the year out.
   */
  variant?: 'card' | 'inset'
}

/**
 * A run as a list row (v4.17): its route on a tile, the name, then a meta
 * line - the type's dot, the date, the type and the RPE - and on the right
 * the distance over the pace, each with its unit.
 */
export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], variant = 'card' }: Props) {
  const title = a.description || t.activity.runTitle(a.dayOfWeek)
  const meta = [
    formatDate(a.date, variant === 'inset' ? { year: 'never' } : {}),
    // A type this build does not know yet has no label; name it as it came.
    t.activityTypes[a.type] ?? a.type,
    a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/activities/${a.id}`}
      data-testid="thumb-row"
      className={cn(
        'flex items-center gap-3.5 text-left transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]',
        variant === 'card' ? 'px-4 py-3' : 'rounded-[10px] px-3 py-2.5',
      )}
    >
      <RouteThumb path={a.routeThumb} type={a.type} size={48} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight text-foreground">{title}</span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <TypeDot type={a.type} size={6} />
          <span className="truncate">{meta}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.75">
        <span className="text-[15px] font-semibold leading-tight text-foreground">
          {formatDistance(a.distanceKm)}
          <Unit>{t.units.km}</Unit>
        </span>
        {a.paceSecPerKm !== null && <span className="text-xs text-muted-foreground">{formatPace(a.paceSecPerKm)}</span>}
      </span>
    </Link>
  )
}
