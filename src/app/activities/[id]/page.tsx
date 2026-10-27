import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { getRecords, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { officialResultsByActivityId } from '@/domain/activity/raceResult'
import { ActivityDetailClient } from '@/components/activity/ActivityDetailClient'
import { activityDetailView, runName, shareActivity, shownType } from '@/components/activity/activityViews'
import { ActivityNav } from '@/components/activity/ActivityNav'
import { ShareButton } from '@/components/activity/ShareButton'
import { OfficialResult } from '@/components/activity/OfficialResult'
import { NewGround } from '@/components/activity/NewGround'
import { getRunExploreGain } from '@/application/usecases/GetExploreGains'
import { getSimilarRuns } from '@/application/usecases/GetSimilarRuns'
import { getDynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { getRunVerdictInsight } from '@/application/usecases/GetRunVerdictInsight'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getRunSessions } from '@/application/coaching/GetCoachingView'
import { sessionForRun } from '@/domain/coaching/sessionForRun'
import { controlledRunView } from '@/application/coaching/controlledRunView'
import { ControlledThresholdCard } from '@/components/activity/ControlledThresholdCard'
import { sessionLabel } from '@/lib/activityTitle'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { chartZones } from '@/components/activity/chartStackLanes'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { appTodayIso } from '@/lib/calendarDate'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

/** The newest runs, the ones opened most, are built ahead; the rest render on first visit and are kept as these are. */
const PRERENDERED_RUNS = 20

// The title and the page each name the coach's session: one read of the plans per request.
const runSessions = cache(() => getRunSessions())

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await loadData()
  const { id } = await params
  const activity = getActivities().find((a) => a.id === id)
  if (!activity) return { title: t.activity.metaFallbackTitle }

  const name = runName(activity, sessionForRun(activity, runSessions()))
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
  return getActivities()
    .slice(0, PRERENDERED_RUNS)
    .map((a) => ({ id: a.id }))
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
  const shoeRegistry = getShoeRegistry()
  const registeredShoe = activity.gearId ? shoeRegistry[activity.gearId] : undefined
  const shoeOptions = Object.entries(shoeRegistry)
    .filter(([gearId, info]) => !info.retired || gearId === activity.gearId)
    .map(([gearId, info]) => ({ gearId, name: info.name, dotColor: info.dotColor }))
  const newGround = getRunExploreGain(id)
  const shoe = registeredShoe && activity.gearId
    ? { gearId: activity.gearId, name: registeredShoe.name, dotColor: registeredShoe.dotColor, source: activity.gearSource }
    : null
  // The coach's session this run was, for its name in the header and on the share card, and its reps' target pace.
  const session = sessionForRun(activity, runSessions())
  const controlledRun = controlledRunView(activity, session)
  // The watch's own plan for the day, for a rep target the coach never matched.
  const plannedForDay = (await getPlannedWorkouts()).find((w) => w.date === activity.date.slice(0, 10)) ?? null

  // Only the zone edges reach the page, not the athlete profile.
  const athlete = getAthleteProfile()
  const trainingZones = await getTrainingZones(appTodayIso())
  const zones = chartZones(activity.hrZones, athlete.hrZoneBoundsBpm, trainingZones?.zones, { paceEstimated: !!trainingZones?.estimate })

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
        shoeOptions={shoeOptions}
        similarRuns={similarRuns}
        extras={
          officialResult || newGround || controlledRun ? (
            <>
              {controlledRun && <ControlledThresholdCard view={controlledRun} />}
              {officialResult && (
                <OfficialResult
                  result={officialResult}
                  garminDistanceKm={activity.distanceKm}
                  garminDurationSeconds={activity.durationSeconds}
                  isPersonalBest={holdsOfficialRecord}
                />
              )}
              {newGround && <NewGround gain={newGround} />}
            </>
          ) : null
        }
        footer={<ActivityNav prev={prevActivity} next={nextActivity} />}
      />
    </div>
  )
}
