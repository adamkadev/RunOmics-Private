import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId } from '@/domain/activity/raceResult'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { activityDetailView, runName, shareActivity, shareSession, shownType } from '@/components/activity/activityViews'
import { ActivityNav } from '@/components/activity/ActivityNav'
import { ShareButton } from '@/components/activity/ShareButton'
import { ActivityAchievements } from '@/components/activity/ActivityAchievements'
import { OfficialResult } from '@/components/activity/OfficialResult'
import { NewGround } from '@/components/activity/NewGround'
import { getRunExploreGain } from '@/application/usecases/GetExploreGains'
import { getSimilarRuns } from '@/application/usecases/GetSimilarRuns'
import { getDynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { getRunVerdictInsight } from '@/application/usecases/GetRunVerdictInsight'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getRunSessions } from '@/application/coaching/GetCoachingView'
import { sessionLabel } from '@/lib/activityTitle'
import { paceZones } from '@/application/usecases/GetTrainingZones'
import { chartZones } from '@/components/activity/chartStackLanes'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await loadData()
  const { id } = await params
  const activity = getActivities().find((a) => a.id === id)
  if (!activity) return { title: t.activity.metaFallbackTitle }

  const name = runName(activity, shareSession(getRunSessions(), activity))
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
  await loadData()
  const activities = getActivities()
  return activities.map((a) => ({ id: a.id }))
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await loadData()
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
  const newGround = getRunExploreGain(id)
  const shoe = registeredShoe ? { name: registeredShoe.name, dotColor: registeredShoe.dotColor } : null
  // The coach's session this run was, for its name in the header and on the share card, and its reps' target pace.
  const session = shareSession(getRunSessions(), activity)
  // The watch's own plan for the day, for a rep target the coach never matched.
  const plannedForDay = (await getPlannedWorkouts()).find((w) => w.date === activity.date.slice(0, 10)) ?? null

  // Only the zone edges reach the page, not the athlete profile.
  const athlete = getAthleteProfile()
  const zones = chartZones(
    activity.hrZones,
    athlete.hrZoneBoundsBpm,
    athlete.thresholdPaceSecPerKm ? paceZones(athlete.thresholdPaceSecPerKm) : null,
  )

  return (
    <div className="flex flex-col gap-3.5">
      <ActivityDetailClient
        activity={activityDetailView(activity)}
        // The set alone: the type is the dot over it, and the tab's title keeps the whole name.
        name={sessionLabel(runName(activity, session))}
        shownType={shownType(activity, session)}
        dateLabel={formatDate(activity.date)}
        comment={activity.comment || undefined}
        qualifiedEfforts={qualifiedEfforts}
        aiVerdict={aiVerdict}
        chartZones={zones}
        back={<BackButton label={t.activity.back} fallbackHref="/activities" variant="round" />}
        share={<ShareButton activity={shareActivity(activity, session, aiVerdict, plannedForDay)} />}
        dynamicsBaseline={getDynamicsBaseline(activity)}
        shoe={shoe}
        similarRuns={similarRuns}
        extras={
          officialResult || activity.bestEfforts || newGround ? (
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
              {newGround && <NewGround gain={newGround} />}
            </>
          ) : null
        }
      />

      <ActivityNav prev={prevActivity} next={nextActivity} />
    </div>
  )
}
