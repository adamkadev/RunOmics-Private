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
import { activityTitle } from '@/lib/activityTitle'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
  /**
   * `card`: a row of a list card, divided by the card (Today's recent runs,
   * a list sorted by something other than date). `inset`: a rounded row
   * inside an Activities week card, under its month's heading, so its meta
   * line is the weekday, the time and the heart rate (3.0).
   */
  variant?: 'card' | 'inset'
}

/**
 * A run as a list row (v4.17): its route on a tile, the name, then a meta
 * line - the type's dot, the date, the type and the RPE - and on the right
 * the distance over the pace, each with its unit.
 */
export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], variant = 'card' }: Props) {
  const title = activityTitle(a)
  const inset = variant === 'inset'
  // In a week the type is the dot and the week names the month: "Sun 18 ·
  // 1:06:39 · 145 bpm" (3.0).
  const meta = (
    inset
      ? [
          formatWeekday(a.date, true),
          formatDuration(a.durationSeconds),
          a.avgHeartRate !== null ? `${Math.round(a.avgHeartRate)} ${t.units.bpm}` : null,
        ]
      : [
          formatDate(a.date),
          // A type this build does not know yet has no label; name it as it came.
          t.activityTypes[a.type] ?? a.type,
          a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null,
        ]
  )
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
