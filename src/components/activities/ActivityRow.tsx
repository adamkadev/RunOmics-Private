import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ActivityTypeTag } from './ActivityTypeTag'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'

const TYPE_ACCENT: Record<ActivityType, string> = {
  Sprint:    'fuchsia',
  Anaerobic: 'purple',
  VO2Max:    'red',
  Threshold: 'orange',
  Tempo:     'yellow',
  Base:      'green',
  Race:      'amber',
}

interface Props {
  activity: Activity
}

export function ActivityRow({ activity: a }: Props) {
  return (
    <Link
      href={`/activities/${a.id}`}
      className={cardClass({
        accent: TYPE_ACCENT[a.type],
        clickable: true,
        className: 'grid grid-cols-[1fr_auto] items-center gap-x-4',
      })}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTypeTag type={a.type} />
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
        <div className="hidden w-24 xl:block">
          <p className="truncate font-medium text-foreground/80">
            {a.rpe !== null ? (t.rpeLabels[a.rpe] ?? '-') : t.activities.row.na}
          </p>
          <p className="text-xs text-subtle">
            {a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : t.activities.row.rpe}
          </p>
        </div>
      </div>
    </Link>
  )
}
