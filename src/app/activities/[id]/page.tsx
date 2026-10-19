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
import { TypeDot } from '@/components/ui/TypeDot'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { appTodayIso } from '@/lib/calendarDate'
import { paceZones } from '@/application/usecases/GetTrainingZones'
import { chartZones } from '@/components/activity/chartStackLanes'
import { RunPlace } from '@/components/activity/RunPlace'
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

  // After a run the page opens on the run (v4.17): '← Activities', the title
  // with its date, type and place and Share on its row, the map card with
  // the four numbers, the verdict with effort, conditions, shoe and note,
  // then the tabs. The header is handed to the client, which draws it on
  // every tab.
  return (
    <div className="flex flex-col gap-3.5">
      <ActivityDetailClient
        activity={activityDetailView(activity)}
        qualifiedEfforts={qualifiedEfforts}
        aiVerdict={aiVerdict}
        chartZones={zones}
        header={
          <>
            <BackButton label={t.activity.back} fallbackHref="/activities" className="mb-0 self-start" />

            {/* The page header: H1 and a 14 pt muted subtitle, the page's
                action right-aligned on the same row. */}
            <header className="mb-1.5 flex items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="text-display text-foreground">
                  {runName(activity, session)}
                </h1>
                {/* Date · type · place: the type as its zone dot and its
                    name in text-2 (v4.17). */}
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground" data-testid="activity-subtitle">
                  {formatDate(activity.date)}
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--text-2)]">
                    <TypeDot type={activity.type} />
                    {t.activityTypes[activity.type]}
                  </span>
                  <RunPlace activityId={activity.id} start={activity.route?.[0] ?? null} />
                </p>
                {/* Under the title too, so it fades with the date line
                    rather than show cut under the compact title bar. */}
                {activity.comment && (
                  <p data-title-sub className="text-sm text-muted-foreground">{activity.comment}</p>
                )}
              </div>
              <ShareButton activity={shareActivity(activity, session, aiVerdict)} />
            </header>
          </>
        }
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
