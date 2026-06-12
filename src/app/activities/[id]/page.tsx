import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Timer, Footprints, Heart, TrendingUp, Mountain, Zap, Flame, MessageSquare } from 'lucide-react'
import { getActivities } from '@/application/usecases/GetActivities'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { ZoneBar } from '@/components/activity/ZoneBar'
import { TrainingEffect } from '@/components/activity/TrainingEffect'
import { RunningDynamics } from '@/components/activity/RunningDynamics'
import { HrChart } from '@/components/activity/HrChart'
import { ElevationChart } from '@/components/activity/ElevationChart'
import { NoRouteMap } from '@/components/activity/ActivityMap'
import { ActivityMapClient } from '@/components/activity/ActivityMapClient'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { RPE_LABELS } from '@/domain/activity/types'

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  )
}

export async function generateStaticParams() {
  const activities = getActivities()
  return activities.map((a) => ({ id: a.id }))
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const activity = getActivities().find((a) => a.id === id)
  if (!activity) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/activities"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        Activities
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <ActivityTypeTag type={activity.type} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {activity.description || activity.dayOfWeek + ' Run'}
          </h1>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {formatDate(activity.date)}
          </span>
        </div>
        {activity.comment && (
          <div className="mt-2 flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
            <MessageSquare size={14} className="mt-0.5 shrink-0" />
            {activity.comment}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatItem
          icon={<Footprints size={16} className="text-emerald-500" />}
          label="Distance"
          value={formatDistance(activity.distanceKm)}
        />
        <StatItem
          icon={<Timer size={16} className="text-blue-500" />}
          label="Duration"
          value={formatDuration(activity.durationSeconds)}
        />
        {activity.paceSecPerKm && (
          <StatItem
            icon={<TrendingUp size={16} className="text-violet-500" />}
            label="Avg Pace"
            value={formatPace(activity.paceSecPerKm)}
          />
        )}
        {activity.avgHeartRate && (
          <StatItem
            icon={<Heart size={16} className="text-red-500" />}
            label="Avg HR"
            value={`${activity.avgHeartRate} bpm`}
          />
        )}
        {activity.elevationGain && (
          <StatItem
            icon={<Mountain size={16} className="text-stone-500" />}
            label="Elevation"
            value={`+${activity.elevationGain}m`}
          />
        )}
        {activity.calories != null && (
          <StatItem
            icon={<Flame size={16} className="text-orange-500" />}
            label="Calories"
            value={`${activity.calories} kcal`}
          />
        )}
        <StatItem
          icon={<Zap size={16} className="text-amber-500" />}
          label={activity.rpe !== null ? `RPE ${activity.rpe}` : 'RPE'}
          value={activity.rpe !== null ? (RPE_LABELS[activity.rpe] ?? '—') : 'N/A'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {activity.route ? (
            <ActivityMapClient route={activity.route} className="h-full min-h-[300px]" />
          ) : (
            <NoRouteMap className="h-full min-h-[300px]" />
          )}
        </div>
        <div className="space-y-4 lg:col-span-2">
          <ZoneBar hrZones={activity.hrZones} />
          <TrainingEffect
            aer={activity.aerTrainingEffect}
            ana={activity.anaTrainingEffect}
          />
        </div>
      </div>

      {(activity.hrSamples || activity.elevationProfile) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activity.hrSamples && (
            <HrChart
              samples={activity.hrSamples}
              avgHr={activity.avgHeartRate}
              durationSeconds={activity.durationSeconds}
            />
          )}
          {activity.elevationProfile && (
            <ElevationChart
              samples={activity.elevationProfile}
              durationSeconds={activity.durationSeconds}
              elevationGain={activity.elevationGain}
            />
          )}
        </div>
      )}

      <RunningDynamics activity={activity} />
    </div>
  )
}
