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
   * inside an open Activities week, under its month's heading, so its date
   * leaves the year out.
   */
  variant?: 'card' | 'inset'
  /**
   * `run`: date · moving time · avg HR (Activities, design review Oct 2026).
   * `type`: date · type · RPE, as Today's recent runs still read.
   */
  meta?: 'run' | 'type'
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
 * dot and the meta line, and on the right the distance over the pace, each
 * with its unit.
 */
export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], variant = 'card', meta: metaKind = 'run' }: Props) {
  const title = activityTitle(a)
  const meta =
    metaKind === 'run'
      ? thumbRowMeta(a, variant)
      : [
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
          {/* A long name - a legacy workout's, a past plan's - wraps to two
              lines at most, its longest word broken rather than pushed under
              the distance (design review, Oct 2026). */}
          <span className="line-clamp-2 min-w-0 break-words text-sm font-semibold leading-tight text-foreground text-pretty">{title}</span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <TypeDot type={a.type} size={6} />
          <span className="min-w-0 break-words text-pretty">{meta}</span>
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
