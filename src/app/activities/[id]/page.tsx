import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { HrBounds } from '@/domain/training/trimp'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { ShoePairTag } from '@/components/activities/ShoePairTag'
import { TrainingEffect } from '@/components/activity/TrainingEffect'
import { RunningDynamics } from '@/components/activity/RunningDynamics'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { ActivityNav } from '@/components/activity/ActivityNav'
import { ShareButton } from '@/components/activity/ShareButton'
import { ActivityNotes } from '@/components/activity/ActivityNotes'
import { ActivityAchievements } from '@/components/activity/ActivityAchievements'
import { BestEfforts } from '@/components/activity/BestEfforts'
import { KmSplits } from '@/components/activity/KmSplits'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the pbs/athlete Firestore collections are written.
export const revalidate = 86400

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
  const activities = getActivities()
  const index = activities.findIndex((a) => a.id === id)
  const activity = activities[index]
  if (!activity) notFound()

  const prevActivity = index < activities.length - 1 ? activities[index + 1] ?? null : null
  const nextActivity = index > 0 ? activities[index - 1] ?? null : null

  const records = await getRecords()
  const qualifiedEfforts = getQualifiedEffortsByActivityId(records)[id] ?? []
  const athlete = await getAthleteFromFirestore()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  return (
    <div className="space-y-5">
      <BackButton label={t.activity.back} fallbackHref="/activities" />

      <div>
        <div className="mb-2 flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ActivityTypeTag type={activity.type} />
          <ShoePairTag gearId={activity.gearId} />
        </div>
        <h1 className="text-display text-foreground">
          {activity.description || t.activity.runTitle(activity.dayOfWeek)}
        </h1>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{formatDate(activity.date)}</p>
          <div className="flex items-center gap-2">
            <ActivityNotes activityId={activity.id} />
            <ShareButton activity={activity} />
          </div>
        </div>
        {activity.comment && (
          <p className="mt-1 text-sm text-muted-foreground">{activity.comment}</p>
        )}
      </div>

      {activity.bestEfforts && (
        <ActivityAchievements bestEfforts={activity.bestEfforts} qualifiedEfforts={qualifiedEfforts} />
      )}

      <ActivityDetailClient activity={activity} hrBounds={hrBounds} />

      <div className="space-y-4">
        <KmSplits activity={activity} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TrainingEffect aer={activity.aerTrainingEffect} ana={activity.anaTrainingEffect} />
          {activity.bestEfforts && <BestEfforts bestEfforts={activity.bestEfforts} qualifiedEfforts={qualifiedEfforts} />}
          <RunningDynamics activity={activity} />
        </div>
      </div>

      <ActivityNav prev={prevActivity} next={nextActivity} />
    </div>
  )
}
