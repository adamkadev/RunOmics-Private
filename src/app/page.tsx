import Link from 'next/link'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTrainingStatusDaysBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { getRecords, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getPlannedWorkouts, getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getTodayInsight, todayInsightSession } from '@/application/usecases/GetTodayInsight'
import { getPbCelebrationInsight } from '@/application/usecases/GetPbCelebrationInsight'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView, type HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { appTodayIso } from '@/lib/calendarDate'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { loadWeekTarget } from '@/app/_data/loadWeekTarget'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { StaleSyncBanner } from '@/components/dashboard/StaleSyncBanner'
import { ReadinessCard, latestRatedStatus } from '@/components/dashboard/ReadinessCard'
import { TodayBoard, type SessionCardData } from '@/components/dashboard/TodayBoard'
import { Vo2GradeTodayRow } from '@/components/dashboard/Vo2GradeTodayRow'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { findLastRun, findNextSession } from '@/components/dashboard/nextSession'
import { kindOfType } from '@/components/dashboard/sessionKind'
import { plannedSessionKinds } from '@/components/dashboard/weekStrip'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function DashboardPage() {
  const data = getDashboardData()
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingStatus = await getTrainingStatus()
  const trainingStatusDays = getTrainingStatusDaysBar()
  const records = await getRecords()
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
  // What the rest of the plan holds: the session a rest day points to, and
  // the name under each day of the week strip.
  const plannedWorkouts = await getPlannedWorkouts()
  const coachWorkouts = coaching?.workouts ?? []
  const nextSession = findNextSession(today, coachWorkouts, plannedWorkouts, trainingZones)
  const sessionKinds = plannedSessionKinds(weekTarget.days.map((day) => day.date), coachWorkouts, plannedWorkouts)
  const heroWorkout = todayWorkout && heroWorkoutView(todayWorkout)
  const lastRun = findLastRun(today, todayActivity, heroWorkout, data.recentActivities, coachWorkouts, plannedWorkouts, trainingZones)

  const kindLabel = (kind: string | null) => (kind ? (t.dashboard.weeklyStreak.kinds[kind as keyof typeof t.dashboard.weeklyStreak.kinds]?.label ?? null) : null)
  const sessionCard = (eyebrow: string, workout: HeroWorkoutView | null, title: string): SessionCardData => ({
    eyebrow,
    title,
    workout,
    hrCapBpm: sessionHrCapBpm(workout?.hr, athlete.hrZoneBoundsBpm),
  })
  const nextCard = nextSession
    ? sessionCard(
        t.dashboard.todayHero.tileNext(formatDate(nextSession.date)),
        nextSession.workout ?? null,
        nextSession.workout ? workoutSummary({ ...nextSession.workout, structure: nextSession.workout.structure ?? null }).title : nextSession.title,
      )
    : null
  const todayCard =
    heroWorkout && !todayActivity
      ? sessionCard(
          t.dashboard.todayHero.tileToday(kindLabel(todayCoachWorkout?.prescription.type ?? (todayWorkout?.type ? kindOfType(todayWorkout.type) : null))),
          heroWorkout,
          workoutSummary({ ...heroWorkout, structure: heroWorkout.structure ?? null }).title,
        )
      : null

  return (
    <div className="flex flex-col gap-3.5">
      <CelebrationOverlay record={mostRecentRecord} aiTake={celebrationTake} />

      <DashboardGreeting name={athlete.displayName} lastSyncedAt={lastSyncedAt} />
      <StaleSyncBanner lastSyncedAt={lastSyncedAt} />

      <ReadinessCard status={trainingStatus} watchStatus={latestRatedStatus(trainingStatusDays)} verdict={aiVerdict} />
      <Vo2GradeTodayRow view={getVo2Grade(today)} />

      <TodayBoard session={todayCard ?? nextCard} lastRun={lastRun} />

      {weeklyStreak && (
        <Link href="/plan" aria-label={t.plan.openPlanner} className="block active:scale-[0.99]">
          <WeeklyStreakCard data={weeklyStreak} target={weekTarget} today={today} sessionKinds={sessionKinds} />
        </Link>
      )}
    </div>
  )
}
