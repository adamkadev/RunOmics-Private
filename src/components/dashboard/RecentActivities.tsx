import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity } from '@/domain/activity/types'

interface Props {
  activities: Activity[]
}

export function RecentActivities({ activities }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Recent Activities
        </h3>
        <Link
          href="/activities"
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>

      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {activities.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="w-24 shrink-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {formatDate(a.date)}
              </p>
            </div>
            <div className="w-24 shrink-0">
              <ActivityTypeTag type={a.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-700 dark:text-gray-300">
                {a.description || a.dayOfWeek}
              </p>
              {a.comment && (
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">{a.comment}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-4 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                {formatDistance(a.distanceKm)}
              </span>
              <span className="hidden text-gray-400 sm:block">
                {formatDuration(a.durationSeconds)}
              </span>
              {a.paceSecPerKm && (
                <span className="hidden text-gray-400 lg:block">
                  {formatPace(a.paceSecPerKm)}
                </span>
              )}
              {a.avgHeartRate && (
                <span className="hidden text-gray-400 xl:block">
                  {a.avgHeartRate} bpm
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
