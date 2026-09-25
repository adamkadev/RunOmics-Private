import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId } from '@/domain/activity/raceResult'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { activityDetailView, shareActivity } from '@/components/activity/activityViews'
import { ActivityNav } from '@/components/activity/ActivityNav'
import { ShareButton } from '@/components/activity/ShareButton'
import { ActivityAchievements } from '@/components/activity/ActivityAchievements'
import { OfficialResult } from '@/components/activity/OfficialResult'
import { getSimilarRuns } from '@/application/usecases/GetSimilarRuns'
import { getDynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { getRunVerdictInsight } from '@/application/usecases/GetRunVerdictInsight'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { coachWorkoutView, plannedWorkoutView } from '@/components/plan/planWorkoutView'
import type { ActivityPlan } from '@/components/activity/activityPlan'
import type { Activity } from '@/domain/activity/types'
import { appTodayIso } from '@/lib/calendarDate'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const activity = getActivities().find((a) => a.id === id)
  if (!activity) return { title: t.activity.metaFallbackTitle }

  const name = activity.description || t.activity.runTitle(activity.dayOfWeek)
  const stats = [
    formatDistance(activity.distanceKm),
    formatDuration(activity.durationSeconds),
    activity.paceSecPerKm ? formatPace(activity.paceSecPerKm) : null,
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

/**
 * The plan's session for the day this activity was run, in Plan's own terms: a
 * coach prescription is this run's plan only when it is linked to it, and
 * Garmin's plan for the day is the honest comparison otherwise.
 */
async function planForActivity(activity: Activity): Promise<ActivityPlan | null> {
  const coach = getCoachingOverview(appTodayIso())?.workouts.find(
    (view) => view.state !== 'cancelled' && view.activityId === activity.id,
  )
  const garmin = (await getPlannedWorkouts()).find((p) => p.date === activity.date) ?? null
  const zones = await getTrainingZones()
  const view = coach ? coachWorkoutView(coach, zones, garmin) : garmin ? plannedWorkoutView(garmin, zones) : null
  if (!view) return null
  return {
    title: view.title,
    ...(view.type ? { type: view.type } : {}),
    distanceM: view.distanceM,
    durationSeconds: view.duration?.seconds ?? null,
  }
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
  const similarRuns = getSimilarRuns(id)
  const aiVerdict = await getRunVerdictInsight(activity)
  const officialResult = officialResultsByActivityId(getOfficialRaceResults()).get(id) ?? null
  const holdsOfficialRecord = records.some((record) => record.official && record.activityId === id)
  const registeredShoe = activity.gearId ? getShoeRegistry()[activity.gearId] : undefined
  const shoe = registeredShoe ? { name: registeredShoe.name, dotColor: registeredShoe.dotColor } : null

  const plan = await planForActivity(activity)

  // After a run the page opens on the run: title, the map, its numbers, the
  // verdict with plan against actual, how it felt, then the tabs. The header
  // is handed to the client, which keeps a one-line version of it on the
  // other tabs.
  return (
    <div className="space-y-4">
      <ActivityDetailClient
        activity={activityDetailView(activity)}
        qualifiedEfforts={qualifiedEfforts}
        aiVerdict={aiVerdict}
        header={
          <>
            <div className="flex items-center justify-between gap-3">
              <BackButton label={t.activity.back} fallbackHref="/activities" />
              <ShareButton activity={shareActivity(activity)} />
            </div>

            <div>
              <h1 className="text-display text-foreground">
                {activity.description || t.activity.runTitle(activity.dayOfWeek)}
              </h1>
              <p className="mt-1 text-footnote text-muted-foreground">
                {[formatDate(activity.date), shoe?.name].filter(Boolean).join(' · ')}
              </p>
              {activity.comment && (
                <p className="mt-1 text-sm text-muted-foreground">{activity.comment}</p>
              )}
            </div>
          </>
        }
        compactTitle={`${activity.description || t.activity.runTitle(activity.dayOfWeek)} · ${formatDate(activity.date)}`}
        dynamicsBaseline={getDynamicsBaseline(activity)}
        plan={plan}
        similarRuns={similarRuns}
        extras={
          officialResult || activity.bestEfforts ? (
            <>
              {officialResult && (
                <OfficialResult
                  result={officialResult}
                  garminDistanceKm={activity.distanceKm}
                  garminDurationSeconds={activity.durationSeconds}
                  isPersonalBest={holdsOfficialRecord}
                />
              )}
              {activity.bestEfforts && (
                <ActivityAchievements bestEfforts={activity.bestEfforts} qualifiedEfforts={qualifiedEfforts} />
              )}
            </>
          ) : null
        }
      />

      <ActivityNav prev={prevActivity} next={nextActivity} />
    </div>
  )
}
