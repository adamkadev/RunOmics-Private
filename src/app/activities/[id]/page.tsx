import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords } from '@/application/usecases/GetRecords'
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
    openGraph: { title: name, description: stats, type: 'article' },
    twitter: { card: 'summary', title: name, description: stats },
  }
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

  const records = await getRecords()
  const prLabels = records
    .filter((r) => r.activityId === id)
    .map((r) => r.label)

  return (
    <div>
      <BackButton label={t.activity.back} fallbackHref="/activities" />

      <ActivityDetailClient
        activity={activity}
        header={
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ActivityTypeTag type={activity.type} />
              {prLabels.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  <Trophy size={11} />
                  {t.activity.bestEfforts.prBadge} - {prLabels.join(' - ')}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {activity.description || t.activity.runTitle(activity.dayOfWeek)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(activity.date)}</p>
            {activity.comment && (
              <p className="mt-1 text-sm text-muted-foreground">{activity.comment}</p>
            )}
          </div>
        }
        footer={
          <>
            <ZoneBar key="zones" hrZones={activity.hrZones} />
            <TrainingEffect
              key="training-effect"
              aer={activity.aerTrainingEffect}
              ana={activity.anaTrainingEffect}
            />
            {activity.bestEfforts && <BestEfforts key="best-efforts" bestEfforts={activity.bestEfforts} />}
            <RunningDynamics key="dynamics" activity={activity} />
          </>
        }
      />
    </div>
  )
}
