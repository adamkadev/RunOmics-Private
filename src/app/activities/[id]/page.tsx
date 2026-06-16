import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Timer, Footprints, Heart, TrendingUp, Mountain, Zap, Flame, MessageSquare, Gauge } from 'lucide-react'
import { getActivities } from '@/application/usecases/GetActivities'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { ZoneBar } from '@/components/activity/ZoneBar'
import { TrainingEffect } from '@/components/activity/TrainingEffect'
import { RunningDynamics } from '@/components/activity/RunningDynamics'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { BestEfforts } from '@/components/activity/BestEfforts'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const activity = getActivities().find((a) => a.id === id)
  if (!activity) return { title: t.activity.metaFallbackTitle }

  const name = activity.description || t.activity.runTitle(activity.dayOfWeek)
  const stats = [
    formatDistance(activity.distanceKm),
    formatDuration(activity.durationSeconds),
    activity.paceSecPerKm ? `${formatPace(activity.paceSecPerKm)}/km` : null,
    formatDate(activity.date),
  ].filter(Boolean).join(' · ')

  return {
    title: name,
    description: stats,
    openGraph: {
      title: name,
      description: stats,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: name,
      description: stats,
    },
  }
}

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}

function StatItem({ icon, label, value, className }: StatItemProps) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-card ${className ?? ''}`}>
      <div className="text-subtle">{icon}</div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-xs text-subtle">{label}</span>
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

  const statItems = [
    {
      icon: <Footprints size={16} className="text-emerald-500 dark:text-emerald-400" />,
      label: t.activity.stats.distance,
      value: formatDistance(activity.distanceKm),
    },
    {
      icon: <Timer size={16} className="text-blue-500 dark:text-blue-400" />,
      label: t.activity.stats.duration,
      value: formatDuration(activity.durationSeconds),
    },
    ...(activity.paceSecPerKm
      ? [{
          icon: <TrendingUp size={16} className="text-violet-500 dark:text-violet-400" />,
          label: t.activity.stats.avgPace,
          value: formatPace(activity.paceSecPerKm),
        }]
      : []),
    ...(activity.avgHeartRate
      ? [{
          icon: <Heart size={16} className="text-red-500 dark:text-red-400" />,
          label: t.activity.stats.avgHr,
          value: `${activity.avgHeartRate} ${t.units.bpm}`,
        }]
      : []),
    ...(activity.calories != null
      ? [{
          icon: <Flame size={16} className="text-orange-500 dark:text-orange-400" />,
          label: t.activity.stats.calories,
          value: t.activity.stats.caloriesValue(activity.calories),
        }]
      : []),
    ...(activity.elevationGain
      ? [{
          icon: <Mountain size={16} className="text-stone-500 dark:text-stone-400" />,
          label: t.activity.stats.elevation,
          value: t.activity.stats.elevationValue(activity.elevationGain),
        }]
      : []),
    ...(activity.cadenceSpm != null
      ? [{
          icon: <Gauge size={16} className="text-sky-500 dark:text-sky-400" />,
          label: t.activity.stats.cadence,
          value: `${Math.round(activity.cadenceSpm)} ${t.units.spm}`,
        }]
      : []),
    {
      icon: <Zap size={16} className="text-amber-500 dark:text-amber-400" />,
      label: activity.rpe !== null ? t.activity.stats.rpeValue(activity.rpe) : t.activity.stats.rpe,
      value: activity.rpe !== null ? (t.rpeLabels[activity.rpe] ?? '-') : t.activity.stats.na,
    },
  ]

  return (
    <div className="space-y-6">
      <Link
        href="/activities"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {t.activity.back}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <ActivityTypeTag type={activity.type} />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {activity.description || t.activity.runTitle(activity.dayOfWeek)}
            </h1>
            <span className="text-sm text-subtle">
              {formatDate(activity.date)}
            </span>
          </div>
          {activity.comment && (
            <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <MessageSquare size={14} className="mt-0.5 shrink-0" />
              {activity.comment}
            </div>
          )}
        </div>

      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {statItems.map((item, idx) => (
          <StatItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            // Odd count leaves a lonely card on the 2-col mobile grid: let the last one fill the row.
            className={statItems.length % 2 === 1 && idx === statItems.length - 1 ? 'col-span-2 sm:col-span-1' : ''}
          />
        ))}
      </div>

      <ActivityDetailClient
        activity={activity}
        sidePanel={
          <>
            <ZoneBar hrZones={activity.hrZones} />
            <TrainingEffect
              aer={activity.aerTrainingEffect}
              ana={activity.anaTrainingEffect}
            />
          </>
        }
      />

      {activity.bestEfforts && <BestEfforts bestEfforts={activity.bestEfforts} />}

      <RunningDynamics activity={activity} />
    </div>
  )
}
