import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ActivityTypeTag } from './ActivityTypeTag'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { RPE_LABELS } from '@/domain/activity/types'
import type { Activity } from '@/domain/activity/types'

interface Props {
  activity: Activity
}

export function ActivityRow({ activity: a }: Props) {
  return (
    <Link
      href={`/activities/${a.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTypeTag type={a.type} />
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(a.date)}</span>
          {a.comment && (
            <MessageSquare size={12} className="text-gray-300 dark:text-gray-600" />
          )}
        </div>
        {a.description && (
          <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            {a.description}
          </p>
        )}
        {a.comment && (
          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{a.comment}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-5 text-right text-sm">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {formatDistance(a.distanceKm)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">distance</p>
        </div>
        <div className="hidden sm:block">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {formatDuration(a.durationSeconds)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">duration</p>
        </div>
        {a.paceSecPerKm && (
          <div className="hidden md:block">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {formatPace(a.paceSecPerKm)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">pace</p>
          </div>
        )}
        {a.avgHeartRate && (
          <div className="hidden lg:block">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {a.avgHeartRate} <span className="text-xs font-normal">bpm</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">avg HR</p>
          </div>
        )}
        <div className="hidden w-24 xl:block">
          <p className="truncate font-medium text-gray-700 dark:text-gray-300">
            {a.rpe !== null ? (RPE_LABELS[a.rpe] ?? '-') : 'N/A'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {a.rpe !== null ? `RPE ${a.rpe}` : 'RPE'}
          </p>
        </div>
      </div>
    </Link>
  )
}
