import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ActivityTypeTag } from './ActivityTypeTag'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity } from '@/domain/activity/types'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'

function rpeChipClass(rpe: number): string {
  if (rpe <= 3) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (rpe <= 5) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  if (rpe <= 7) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

interface Props {
  activity: Activity
}

export function ActivityRow({ activity: a }: Props) {
  return (
    <Link
      href={`/activities/${a.id}`}
      className={cardClass({
        clickable: true,
        className: 'grid grid-cols-[1fr_auto] items-center gap-x-4',
      })}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTypeTag type={a.type} />
          {a.rpe !== null && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${rpeChipClass(a.rpe)}`}>
              RPE {a.rpe}
            </span>
          )}
          <span className="text-xs text-subtle">{formatDate(a.date)}</span>
          {a.comment && (
            <MessageSquare size={12} className="text-subtle" />
          )}
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
          <p className="font-semibold text-foreground">
            {formatDistance(a.distanceKm)}
          </p>
          <p className="text-xs text-subtle">{t.activities.row.distance}</p>
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
