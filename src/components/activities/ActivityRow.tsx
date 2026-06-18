import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ActivityTypeTag } from './ActivityTypeTag'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const TYPE_BORDER: Record<ActivityType, string> = {
  Sprint:    'border-l-fuchsia-400 dark:border-l-fuchsia-500',
  Anaerobic: 'border-l-purple-400 dark:border-l-purple-500',
  VO2Max:    'border-l-red-400 dark:border-l-red-500',
  Threshold: 'border-l-orange-400 dark:border-l-orange-500',
  Tempo:     'border-l-yellow-400 dark:border-l-yellow-500',
  Base:      'border-l-green-400 dark:border-l-green-500',
  Race:      'border-l-amber-400 dark:border-l-amber-500',
}

interface Props {
  activity: Activity
}

export function ActivityRow({ activity: a }: Props) {
  return (
    <Link
      href={`/activities/${a.id}`}
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-xl border border-border border-l-4 bg-card p-4 shadow-card transition-shadow hover:shadow-md',
        TYPE_BORDER[a.type] ?? 'border-l-border'
      )}
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
