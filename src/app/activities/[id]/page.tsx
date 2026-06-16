import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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

  return (
    <div>
      <Link
        href="/activities"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {t.activity.back}
      </Link>

      <ActivityDetailClient
        activity={activity}
        header={
          <div>
            <ActivityTypeTag type={activity.type} className="mb-2" />
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
