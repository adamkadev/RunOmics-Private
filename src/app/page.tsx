import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getRecentLoad } from '@/application/usecases/GetRecentLoad'
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
import { loadWeekTarget } from '@/app/_data/loadWeekTarget'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { StaleSyncBanner } from '@/components/dashboard/StaleSyncBanner'
import { ReadinessCard } from '@/components/dashboard/ReadinessCard'
import { TodayBoard } from '@/components/dashboard/TodayBoard'
import { Vo2GradeTodayRow } from '@/components/dashboard/Vo2GradeTodayRow'
import { ThisWeekCard } from '@/components/dashboard/ThisWeekCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { findNextSession, sessionCard } from '@/components/dashboard/nextSession'
import { plannedSessionKinds } from '@/components/dashboard/weekStrip'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'

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
  const recentLoad = await getRecentLoad(today)
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

      <ReadinessCard status={trainingStatus} verdict={aiVerdict} load={recentLoad?.reading ?? null} />
      <TodayBoard session={card} />
      <Vo2GradeTodayRow view={getVo2Grade(today)} />

      {/* One Mon–Sun card for the week's km and the load (App Fixes 1a v2):
          it replaces the circle row and the seven-day load chart. */}
      <ThisWeekCard target={weekTarget} today={today} sessionKinds={sessionKinds} load={recentLoad?.reading ?? null} />
    </div>
  )
}
