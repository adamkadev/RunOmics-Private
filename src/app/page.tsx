import Link from 'next/link'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getRecords, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getPlannedWorkouts, getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getTodayInsight, todayInsightSession } from '@/application/usecases/GetTodayInsight'
import { getPbCelebrationInsight } from '@/application/usecases/GetPbCelebrationInsight'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView } from '@/components/plan/planWorkoutView'
import { planPhaseLine } from '@/components/plan/planPhase'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { appTodayIso } from '@/lib/calendarDate'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { loadWeekTarget } from '@/app/_data/loadWeekTarget'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { StaleSyncBanner } from '@/components/dashboard/StaleSyncBanner'
import { ReadinessCard } from '@/components/dashboard/ReadinessCard'
import { TodayBoard } from '@/components/dashboard/TodayBoard'
import { Vo2GradeTodayRow } from '@/components/dashboard/Vo2GradeTodayRow'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { findLastRun, findNextSession, sessionCard } from '@/components/dashboard/nextSession'
import { plannedSessionKinds } from '@/components/dashboard/weekStrip'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function DashboardPage() {
  // One date for the whole render, in the athlete's zone when one is set, and
  // every "today" lookup below takes it. The Garmin fallback used to read the
  // server's UTC date, so for two hours after midnight in Luxembourg Monday's
  // rest day showed Sunday's long run.
  const today = appTodayIso()
  const data = getDashboardData(today)
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingStatus = await getTrainingStatus()
  const records = await getRecords()
  const mostRecentRecord = getMostRecentRecord(records)
  const todayPlannedWorkout = await getTodayPlannedWorkout(today)
  const weeklyStreak = getWeeklyStreakData(new Date(`${today}T12:00:00`))
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
  const aiVerdict = await getTodayInsight(trainingStatus, await todayInsightSession(today), today)
  const celebrationTake = await getPbCelebrationInsight(mostRecentRecord)
  // What the rest of the plan holds: the session a rest day points to, and
  // the name under each day of the week strip.
  const plannedWorkouts = await getPlannedWorkouts()
  const coachWorkouts = coaching?.workouts ?? []
  const nextSession = findNextSession(today, coachWorkouts, plannedWorkouts, trainingZones)
  const sessionKinds = plannedSessionKinds(weekTarget.days.map((day) => day.date), coachWorkouts, plannedWorkouts)
  const heroWorkout = todayWorkout && heroWorkoutView(todayWorkout)
  const lastRun = findLastRun(today, todayActivity, heroWorkout, data.recentActivities, coachWorkouts, plannedWorkouts, trainingZones)

  // The next workout: today's until it is run, then the next, in the phase
  // Plan's subtitle names for its week, with its heart-rate ceiling.
  const phaseRanges = getTrainingPlan()?.ranges ?? []
  const card = sessionCard(today, heroWorkout, todayActivity, nextSession, {
    phaseOn: (date) => planPhaseLine(coaching?.plan ?? null, phaseRanges, date)?.phase ?? null,
    hrCapOf: (workout) => sessionHrCapBpm(workout?.hr, athlete.hrZoneBoundsBpm),
  })

  return (
    <div className="flex flex-col gap-3">
      <CelebrationOverlay record={mostRecentRecord} aiTake={celebrationTake} />

      <DashboardGreeting name={athlete.displayName} lastSyncedAt={lastSyncedAt} today={today} />
      <StaleSyncBanner lastSyncedAt={lastSyncedAt} />

      <ReadinessCard status={trainingStatus} verdict={aiVerdict} />
      <TodayBoard session={card} lastRun={lastRun} />
      <Vo2GradeTodayRow view={getVo2Grade(today)} />

      {weeklyStreak && (
        <Link href="/plan" aria-label={t.plan.openPlanner} className="mt-1 block active:scale-[0.99]">
          <WeeklyStreakCard data={weeklyStreak} target={weekTarget} today={today} sessionKinds={sessionKinds} />
        </Link>
      )}
    </div>
  )
}
