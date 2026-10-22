import Link from 'next/link'
import { PrBadge } from './PrBadge'
import { RouteThumb } from '@/components/ui/RouteThumb'
import { TypeDot } from '@/components/ui/TypeDot'
import { Unit } from '@/components/ui/Stat'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDate, formatDistance, formatDuration, formatPace, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { activityTitle, sessionLabel } from '@/lib/activityTitle'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
  /** The type the row shows, its session's where it is not the watch's (round 2); else the run's. */
  type?: ActivityType
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
 * A run as a list row (v4.17): its route on a tile, the session, then the
 * type's dot and the meta line, and on the right the distance over the pace,
 * each with its unit.
 */
export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], type = a.type, variant = 'card' }: Props) {
  // The session on the first line, its type the dot beside the meta (round
  // 2, the owner's ask): "3 × 8′ @ 4:25", not "Threshold" over a meta line
  // whose structure the ellipsis cut. A name with no set stays whole.
  const title = sessionLabel(activityTitle(a))
  const meta = thumbRowMeta(a, variant)
  const inset = variant === 'inset'

  return (
    <Link
      href={`/activities/${a.id}`}
      data-testid="thumb-row"
      // Its separator starts under the title (.inset-group, F11).
      data-row-thumb
      className={cn(
        'flex items-center text-left transition-colors active:bg-[var(--fill-4)]',
        // An inset-grouped row (Liquid Glass v3, G9): 64 pt, 10 x 16, the
        // 44 pt thumbnail 12 pt from the text - so the list's separators,
        // inset 72 pt, start under the title.
        variant === 'card' ? 'gap-3.5 px-4 py-3 hover:bg-[var(--surface-2)]' : 'min-h-16 gap-3 px-4 py-2.5',
      )}
    >
      <RouteThumb path={a.routeThumb} type={type} size={inset ? 44 : 48} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* A long name - a legacy workout's, a past plan's - wraps to two
              lines at most, its longest word broken rather than pushed under
              the distance (design review, Oct 2026). In a week it is one
              line, ellipsed (3.0). */}
          <span
            className={cn(
              'min-w-0 font-semibold leading-tight text-foreground',
              inset ? 'truncate text-headline' : 'line-clamp-2 break-words text-sm text-pretty',
            )}
          >
            {/* The dot is the type on screen; VoiceOver reads it here. */}
            <span className="sr-only">{`${t.activityTypes[type]} `}</span>
            {title}
          </span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <TypeDot type={type} size={6} />
          <span className={cn('min-w-0', inset ? 'truncate text-[13px]' : 'break-words text-pretty')}>{meta}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.75">
        <span className={cn('font-semibold leading-tight text-foreground', inset ? 'text-headline' : 'text-[15px]')}>
          {formatDistance(a.distanceKm)}
          <Unit>{t.units.km}</Unit>
        </span>
        {a.paceSecPerKm !== null && <span className={cn('text-muted-foreground', inset ? 'text-[13px]' : 'text-xs')}>{formatPace(a.paceSecPerKm)}</span>}
      </span>
    </Link>
  )
}
