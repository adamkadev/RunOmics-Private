import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getPrLabelsByActivityId } from '@/application/usecases/GetRecords'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { PrBadge } from '@/components/activities/PrBadge'
import { ShoePairTag } from '@/components/activities/ShoePairTag'
import { ZoneBar } from '@/components/activity/ZoneBar'
import { TrainingEffect } from '@/components/activity/TrainingEffect'
import { RunningDynamics } from '@/components/activity/RunningDynamics'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { BestEfforts } from '@/components/activity/BestEfforts'
import { KmSplits } from '@/components/activity/KmSplits'
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
  const prLabels = getPrLabelsByActivityId(records)[id] ?? []

  return (
    <div className="space-y-5">
      <BackButton label={t.activity.back} fallbackHref="/activities" />

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <ActivityTypeTag type={activity.type} />
          <PrBadge labels={prLabels} />
          <ShoePairTag gearId={activity.gearId} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {activity.description || t.activity.runTitle(activity.dayOfWeek)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatDate(activity.date)}</p>
        {activity.comment && (
          <p className="mt-1 text-sm text-muted-foreground">{activity.comment}</p>
        )}
      </div>

      <ActivityDetailClient activity={activity} />

      <div className="space-y-4">
        <KmSplits activity={activity} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ZoneBar hrZones={activity.hrZones} />
          <TrainingEffect aer={activity.aerTrainingEffect} ana={activity.anaTrainingEffect} />
        </div>
        {(activity.bestEfforts || activity.strideLengthM != null || activity.groundContactMs != null) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activity.bestEfforts && <BestEfforts bestEfforts={activity.bestEfforts} />}
            <RunningDynamics activity={activity} />
          </div>
        )}
      </div>
    </div>
  )
}
