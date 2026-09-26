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
import { sessionZone, zoneColor } from '@/lib/colors'
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

  // After a run the page opens on the run: title with its date and type,
  // the map, its numbers, the verdict with effort, conditions, shoe and
  // note, then the tabs. The header is handed to the client, which draws it on every tab.
  return (
    <div className="space-y-4">
      <ActivityDetailClient
        activity={activityDetailView(activity)}
        qualifiedEfforts={qualifiedEfforts}
        aiVerdict={aiVerdict}
        header={
          <>
            {/* One row, both ends on the same centre line: the back label's
                own bottom margin used to push the share button off it. */}
            <div className="flex items-center justify-between gap-3">
              <BackButton label={t.activity.back} fallbackHref="/activities" className="mb-0" />
              <ShareButton activity={shareActivity(activity)} />
            </div>

            <div>
              <h1 className="text-display text-foreground">
                {activity.description || t.activity.runTitle(activity.dayOfWeek)}
              </h1>
              {/* The session type joins the date (v4.8 2h): a zone-colour dot
                  and the label in text ink, no chip. */}
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-footnote text-muted-foreground" data-testid="activity-subtitle">
                {formatDate(activity.date)}
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: zoneColor(sessionZone({ type: activity.type })) }} />
                  {t.activityTypes[activity.type]}
                </span>
              </p>
              {activity.comment && (
                <p className="mt-1 text-sm text-muted-foreground">{activity.comment}</p>
              )}
            </div>
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
