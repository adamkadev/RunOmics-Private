import Link from 'next/link'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTrainingStatusDaysBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { getRecords, getQualifiedEffortsByActivityId, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getTodayInsight, todayInsightSession } from '@/application/usecases/GetTodayInsight'
import { getPbCelebrationInsight } from '@/application/usecases/GetPbCelebrationInsight'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView } from '@/components/plan/planWorkoutView'
import { appTodayIso } from '@/lib/calendarDate'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { loadWeekTarget } from '@/app/_data/loadWeekTarget'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { BodyCard } from '@/components/dashboard/BodyCard'
import { LatestRecordRow } from '@/components/dashboard/LatestRecordRow'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function DashboardPage() {
  const data = getDashboardData()
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingStatus = await getTrainingStatus()
  const trainingStatusDays = getTrainingStatusDaysBar()
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const mostRecentRecord = getMostRecentRecord(records)
  const todayPlannedWorkout = await getTodayPlannedWorkout()
  const weeklyStreak = getWeeklyStreakData()
  // One date for the whole render, in the athlete's zone when one is set - the
  // coaching overview used to default to the UTC date while this page used the
  // server's local one.
  const today = appTodayIso()
  const coaching = getCoachingOverview(today)
  const weekTarget = await loadWeekTarget(today, coaching)

  const todayActivity = data.recentActivities.find((a) => a.date === today) ?? null
  const todayCoachWorkout = coaching?.workouts.find((workout) => workout.prescription.date === today && workout.prescription.status !== 'cancelled') ?? null
  const trainingZones = await getTrainingZones()
  const todayWorkout = todayCoachWorkout
    ? coachWorkoutView(todayCoachWorkout, trainingZones, todayPlannedWorkout)
    : todayPlannedWorkout
      ? plannedWorkoutView(todayPlannedWorkout, trainingZones)
      : null
  // A prescribed day used to suppress the verdict outright, which discarded a
  // card the generator had already written and paid for, and left the hero on
  // deterministic copy on exactly the days there was most to say. The session
  // goes into the insight instead of cancelling it.
  const aiVerdict = await getTodayInsight(trainingStatus, await todayInsightSession())
  const celebrationTake = await getPbCelebrationInsight(mostRecentRecord)

  return (
    <div className="space-y-3.5">
      <CelebrationOverlay record={mostRecentRecord} aiTake={celebrationTake} />

      <DashboardGreeting name={athlete.displayName} lastSyncedAt={lastSyncedAt} />

      <TodayHero
        status={trainingStatus}
        plannedWorkout={todayWorkout && heroWorkoutView(todayWorkout)}
        todayActivity={todayActivity}
        aiVerdict={aiVerdict}
      />

      <BodyCard status={trainingStatus} days={trainingStatusDays} />

      {weeklyStreak && (
        <Link href="/plan" aria-label={t.plan.openPlanner} className="block active:scale-[0.99]">
          <WeeklyStreakCard data={weeklyStreak} target={weekTarget} today={today} />
        </Link>
      )}

      <LatestRecordRow record={mostRecentRecord} />

      <RecentActivities
        activities={data.recentActivities.slice(0, 3)}
        qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      />
    </div>
  )
}
