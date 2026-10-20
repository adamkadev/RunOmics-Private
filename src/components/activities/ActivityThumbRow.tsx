import Link from 'next/link'
import { PrBadge } from './PrBadge'
import { RouteThumb } from '@/components/ui/RouteThumb'
import { TypeDot } from '@/components/ui/TypeDot'
import { Unit } from '@/components/ui/Stat'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDate, formatDistance, formatDuration, formatPace, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { activityTitle, splitStructuredTitle } from '@/lib/activityTitle'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
  /**
   * `card`: a row of a list card, divided by the card (Activities sorted by
   * something other than date). `inset`: a rounded row inside an
   * Activities week card, under its month's heading, so its date leaves the
   * month out; a smaller tile and a one-line name (3.0).
   */
  variant?: 'card' | 'inset'
}

/**
 * A row's meta line (design review, Oct 2026): the date, the moving time and
 * the average HR - "Tue 20 · 57:23 · 139 bpm" - the HR left out when the run
 * has none. The type is the dot beside it. Inside its week the weekday and
 * day are enough; a row outside one keeps the month.
 */
export function thumbRowMeta(a: Pick<ActivitySummary, 'date' | 'durationSeconds' | 'avgHeartRate'>, variant: 'card' | 'inset' = 'card'): string {
  return [
    variant === 'inset' ? formatWeekday(a.date, true) : formatDate(a.date),
    a.durationSeconds > 0 ? formatDuration(Math.round(a.durationSeconds)) : null,
    a.avgHeartRate ? `${Math.round(a.avgHeartRate)} ${t.units.bpm}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * A run as a list row (v4.17): its route on a tile, the name, then the type's
 * dot and the meta line - the date first, the structure after it - and on
 * the right the distance over the pace, each with its unit.
 */
export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], variant = 'card' }: Props) {
  // A structured name is its session's name on the first line, its
  // structure leading the meta on the second (3.0.2): one truncated line cut
  // the structure off.
  const { name: title, structure } = splitStructuredTitle(activityTitle(a))
  // The date leads (App Fixes 3d): with the structure first, "2 × 7′ @ 4:25
  // · Tue 13" lost its date to the ellipsis on a narrow row.
  const meta = [thumbRowMeta(a, variant), structure].filter(Boolean).join(' · ')
  const inset = variant === 'inset'

  return (
    <Link
      href={`/activities/${a.id}`}
      data-testid="thumb-row"
      className={cn(
        'flex items-center gap-3.5 text-left transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]',
        variant === 'card' ? 'px-4 py-3' : 'rounded-[10px] px-3 py-2.5',
      )}
    >
      <RouteThumb path={a.routeThumb} type={a.type} size={inset ? 44 : 48} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* A long name - a legacy workout's, a past plan's - wraps to two
              lines at most, its longest word broken rather than pushed under
              the distance (design review, Oct 2026). In a week it is one
              line, ellipsed (3.0). */}
          <span
            className={cn(
              'min-w-0 font-semibold leading-tight text-foreground',
              inset ? 'truncate text-[15px]' : 'line-clamp-2 break-words text-sm text-pretty',
            )}
          >
            {title}
          </span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <TypeDot type={a.type} size={6} />
          <span className={cn('min-w-0', inset ? 'truncate text-[12.5px]' : 'break-words text-pretty')}>{meta}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.75">
        <span className={cn('font-semibold leading-tight text-foreground', inset ? 'text-base' : 'text-[15px]')}>
          {formatDistance(a.distanceKm)}
          <Unit>{t.units.km}</Unit>
        </span>
        {a.paceSecPerKm !== null && <span className="text-xs text-muted-foreground">{formatPace(a.paceSecPerKm)}</span>}
      </span>
    </Link>
  )
}
