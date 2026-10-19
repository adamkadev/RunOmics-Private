import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId } from '@/domain/activity/raceResult'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { activityDetailView, runName, shareActivity, shareSession } from '@/components/activity/activityViews'
import { ActivityNav } from '@/components/activity/ActivityNav'
import { ShareButton } from '@/components/activity/ShareButton'
import { ActivityAchievements } from '@/components/activity/ActivityAchievements'
import { OfficialResult } from '@/components/activity/OfficialResult'
import { getSimilarRuns } from '@/application/usecases/GetSimilarRuns'
import { getDynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { getRunVerdictInsight } from '@/application/usecases/GetRunVerdictInsight'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { appTodayIso } from '@/lib/calendarDate'
import { paceZones } from '@/application/usecases/GetTrainingZones'
import { chartZones } from '@/components/activity/chartStackLanes'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const activity = getActivities().find((a) => a.id === id)
  if (!activity) return { title: t.activity.metaFallbackTitle }

  const name = runName(activity, shareSession(getCoachingOverview(appTodayIso())?.workouts ?? [], activity))
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
  // The coach's session this run was, for the run's name - in the header and
  // on the share card alike - and its reps' target pace (design review, Oct
  // 2026). Older runs had none.
  const session = shareSession(getCoachingOverview(appTodayIso())?.workouts ?? [], activity)

  // The Charts lanes are banded with the run's own HR zones and the
  // athlete's pace zones; only the edges reach the page, not the profile.
  const athlete = getAthleteProfile()
  const zones = chartZones(
    activity.hrZones,
    athlete.hrZoneBoundsBpm,
    athlete.thresholdPaceSecPerKm ? paceZones(athlete.thresholdPaceSecPerKm) : null,
  )

  // After a run the page opens on the run (3.0): the map edge to edge with
  // the way back and Share on it, the title, the four numbers, the verdict
  // with effort, conditions, shoe and note as chips, then the tabs. The same
  // on every tab.
  return (
    <div className="flex flex-col gap-3.5">
      <ActivityDetailClient
        activity={activityDetailView(activity)}
        name={runName(activity, session)}
        dateLabel={formatDate(activity.date)}
        comment={activity.comment || undefined}
        qualifiedEfforts={qualifiedEfforts}
        aiVerdict={aiVerdict}
        chartZones={zones}
        back={<BackButton label={t.activity.back} fallbackHref="/activities" variant="round" />}
        share={<ShareButton activity={shareActivity(activity, session, aiVerdict)} />}
        dynamicsBaseline={getDynamicsBaseline(activity)}
        shoe={shoe}
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
