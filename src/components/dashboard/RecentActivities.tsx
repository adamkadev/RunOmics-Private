import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'
import type { Activity } from '@/domain/activity/types'

interface Props {
  activities: Activity[]
}

export function RecentActivities({ activities }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.dashboard.recentActivities.title}
        </h3>
        <Link
          href="/activities"
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          {t.common.viewAll} <ArrowRight size={12} />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {activities.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="w-24 shrink-0">
              <p className="text-xs font-medium text-muted-foreground">
                {formatDate(a.date)}
              </p>
            </div>
            <div className="w-24 shrink-0">
              <ActivityTypeTag type={a.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground/80">
                {a.description || a.dayOfWeek}
              </p>
              {a.comment && (
                <p className="truncate text-xs text-subtle">{a.comment}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-4 text-sm">
              <span className="font-medium text-foreground">
                {formatDistance(a.distanceKm)}
              </span>
              <span className="hidden text-subtle sm:block">
                {formatDuration(a.durationSeconds)}
              </span>
              {a.paceSecPerKm && (
                <span className="hidden text-subtle lg:block">
                  {formatPace(a.paceSecPerKm)}
                </span>
              )}
              {a.avgHeartRate && (
                <span className="hidden text-subtle xl:block">
                  {a.avgHeartRate} {t.units.bpm}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
