'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PrBadge } from './PrBadge'
import { RouteThumb } from '@/components/ui/RouteThumb'
import { routeThumbPath } from '@/domain/activity/routeThumb'
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
  /** Its session's type where it is not the watch's; else the run's. */
  type?: ActivityType
  /**
   * `card`: a row of a list card. `inset`: a row in a week card, under its
   * month's heading, so its date leaves the month out.
   */
  variant?: 'card' | 'inset'
}

type MetaRun = Pick<ActivitySummary, 'date' | 'durationSeconds' | 'avgHeartRate'>

/** Day, moving time, average HR: null where the run has none. */
export function thumbRowMetaParts(a: MetaRun, variant: 'card' | 'inset' = 'card'): [string, string | null, string | null] {
  return [
    variant === 'inset' ? formatWeekday(a.date, true) : formatDate(a.date),
    a.durationSeconds > 0 ? formatDuration(Math.round(a.durationSeconds)) : null,
    a.avgHeartRate ? `${Math.round(a.avgHeartRate)} ${t.units.bpm}` : null,
  ]
}

export function thumbRowMeta(a: MetaRun, variant: 'card' | 'inset' = 'card'): string {
  return thumbRowMetaParts(a, variant).filter(Boolean).join(' · ')
}

// Widths fit "Wed 28" and "1:27:50", so a week's rows line up their day, time and HR whatever their lengths.
const META_COLUMNS = ['w-[7.5ch] shrink-0', 'w-[9ch] shrink-0', 'min-w-0 truncate']

function MetaColumns({ parts }: { parts: (string | null)[] }) {
  return (
    <span data-testid="thumb-row-meta" className="flex min-w-0 items-baseline whitespace-nowrap text-[13px] tabular-nums">
      {parts.map((part, i) => (
        <span key={i} className={META_COLUMNS[i]}>
          {i > 0 && part && <span aria-hidden>{' · '}</span>}
          {part}
        </span>
      ))}
    </span>
  )
}

export function ActivityThumbRow({ activity: a, qualifiedEfforts = [], type = a.type, variant = 'card' }: Props) {
  // The session as its set ("3 × 8′ @ 4:25"), not its type: the type is the dot beside the meta.
  const title = sessionLabel(activityTitle(a))
  const inset = variant === 'inset'
  const router = useRouter()
  const href = `/activities/${a.id}`
  const prefetch = () => router.prefetch(href)

  return (
    // Not as it scrolls into view: a pass down the archive fetched every page in it. A touch starts the fetch instead.
    <Link
      href={href}
      prefetch={false}
      onPointerDown={prefetch}
      onMouseEnter={prefetch}
      data-testid="thumb-row"
      // Starts its separator under the title (.inset-group).
      data-row-thumb
      className={cn(
        'flex items-center text-left transition-colors active:bg-[var(--fill-4)]',
        // px-4 + the 44 pt thumb + gap-3 = 72 pt, the separators' inset: they start under the title.
        variant === 'card' ? 'gap-3.5 px-4 py-3 hover:bg-[var(--surface-2)]' : 'min-h-16 gap-3 px-4 py-2.5',
      )}
    >
      <RouteThumb path={routeThumbPath(a.routeThumb)} type={type} size={inset ? 44 : 48} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex min-w-0 items-center gap-1.5">
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
          {inset ? (
            <MetaColumns parts={thumbRowMetaParts(a, variant)} />
          ) : (
            <span className="min-w-0 break-words text-pretty">{thumbRowMeta(a, variant)}</span>
          )}
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
