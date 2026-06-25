import Link from 'next/link'
import { ActivityTypeTag } from './ActivityTypeTag'
import { PrBadge } from './PrBadge'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity } from '@/domain/activity/types'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  activity: Activity
  prLabels?: string[]
  /** `glass` renders a lighter translucent sub-surface (Dashboard recent activities, B9). */
  surface?: 'card' | 'glass'
}

export function ActivityRow({ activity: a, prLabels = [], surface = 'card' }: Props) {
  const rowClassName =
    surface === 'glass'
      ? 'glass-row grid grid-cols-[1fr_auto] items-center gap-x-4 p-4 transition-transform active:scale-[0.99]'
      : cardClass({ clickable: true, className: 'grid grid-cols-[1fr_auto] items-center gap-x-4' })

  return (
    <Link href={`/activities/${a.id}`} className={rowClassName}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTypeTag type={a.type} />
          <PrBadge labels={prLabels} />
          {a.rpe !== null && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium text-subtle`}>
              RPE {a.rpe}
            </span>
          )}
          <div className="hidden sm:block">
            <span className="text-xs text-subtle">{formatDate(a.date)}</span>
          </div>
        </div>
        {a.description && (
          <p className="mt-1 text-sm font-medium text-foreground">
            {a.description}
          </p>
        )}
        {a.comment && (
          <p className="mt-0.5 truncate text-xs text-subtle">{a.comment}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-5 text-right text-sm">
        <div>
          <span className="text-xs text-subtle">{formatDate(a.date)}</span>
          <p className="font-semibold text-foreground">
            {formatDistance(a.distanceKm)}
            <span className="text-subtle"> {t.units.km}</span>
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="font-medium text-foreground/80">
            {formatDuration(a.durationSeconds)}
          </p>
          <p className="text-xs text-subtle">{t.activities.row.duration}</p>
        </div>
        {a.paceSecPerKm && (
          <div className="hidden md:block">
            <p className="font-medium text-foreground/80">
              {formatPace(a.paceSecPerKm)}
            </p>
            <p className="text-xs text-subtle">{t.activities.row.pace}</p>
          </div>
        )}
        {a.avgHeartRate && (
          <div className="hidden lg:block">
            <p className="font-medium text-foreground/80">
              {a.avgHeartRate} <span className="text-xs font-normal">{t.units.bpm}</span>
            </p>
            <p className="text-xs text-subtle">{t.activities.row.avgHr}</p>
          </div>
        )}
      </div>
    </Link>
  )
}
