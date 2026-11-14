import { getAthleteProfile } from '@/application/usecases/GetAthleteProfile'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getRecentLoad } from '@/application/usecases/GetRecentLoad'
import { getRecords, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getPlannedWorkouts, getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getTodayInsight, todayInsightSession } from '@/application/usecases/GetTodayInsight'
import { getPbCelebrationInsight } from '@/application/usecases/GetPbCelebrationInsight'
import { getCoachingOverview, getRunSessions } from '@/application/coaching/GetCoachingView'
import { latestJudgedRun } from '@/application/usecases/GetRunVerdictInsight'
import { getActivities } from '@/application/usecases/GetActivities'
import { plannedSessionForRun } from '@/domain/coaching/sessionForRun'
import { runLabel, shownType } from '@/components/activity/activityViews'
import { verdictType } from '@/lib/activityTitle'
import type { YesterdayRun } from '@/components/dashboard/ReadinessCard'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { coachWorkoutView, heroWorkoutView, plannedWorkoutView } from '@/components/plan/planWorkoutView'
import { planPhaseLine } from '@/components/plan/planPhase'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { addDays, appTodayIso, isoDate } from '@/lib/calendarDate'
import { t } from '@/i18n'
import { loadWeekTarget } from '@/app/_data/loadWeekTarget'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { StaleSyncBanner } from '@/components/dashboard/StaleSyncBanner'
import { ReadinessCard } from '@/components/dashboard/ReadinessCard'
import { TodayBoard } from '@/components/dashboard/TodayBoard'
import { Vo2GradeTodayRow } from '@/components/dashboard/Vo2GradeTodayRow'
import { ThisWeekCard } from '@/components/dashboard/ThisWeekCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { getReturnProgress } from '@/application/usecases/GetReturnProgress'
import { findNextSession, sessionCard } from '@/components/dashboard/nextSession'
import { readinessReason } from '@/components/dashboard/readinessReason'
import { plannedSessionKinds } from '@/components/dashboard/weekStrip'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
import { loadData } from '@/application/usecases/LoadData'
import { getHeatAhead } from '@/application/usecases/GetHeatAhead'
import { CheckInCard } from '@/components/wellness/CheckInCard'

export const revalidate = 3600

const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase(t.locale) + text.slice(1)

/** Yesterday's run, named and judged as its page does; none when yesterday had no run. */
function yesterdayRun(today: string): YesterdayRun | null {
  const yesterday = isoDate(addDays(new Date(`${today}T00:00:00`), -1))
  const judged = latestJudgedRun(yesterday)
  if (!judged || judged.activity.date.slice(0, 10) !== yesterday) return null
  const days = new Set(getActivities().map((a) => a.date.slice(0, 10)))
  const session = plannedSessionForRun(judged.activity, getRunSessions(), (day) => days.has(day))
  return {
    href: `/activities/${judged.activity.id}`,
    title: runLabel(judged.activity, session),
    // Written for an uppercase eyebrow, so French starts it lowercase: "footing exigeant".
    word: capitalized(t.activity.verdict.headline[judged.tone](verdictType(shownType(judged.activity, session)))),
    tone: judged.tone,
  }
}

export default async function DashboardPage() {
  await loadData()
  // One date for the whole render, in the athlete's zone when one is set: the server's UTC date is off around midnight.
  const today = appTodayIso()
  const data = getDashboardData()
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingStatus = await getTrainingStatus()
  const records = await getRecords()
  const mostRecentRecord = getMostRecentRecord(records)
  const todayPlannedWorkout = await getTodayPlannedWorkout(today)
  const recentLoad = getRecentLoad(today, trainingStatus)
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
  const [aiVerdict, celebrationTake] = await Promise.all([
    // A prescribed session goes into the insight rather than suppressing it: the card is already written and paid for.
    todayInsightSession(today).then((session) => getTodayInsight(trainingStatus, session, today)),
    getPbCelebrationInsight(mostRecentRecord),
  ])
  const plannedWorkouts = await getPlannedWorkouts()
  const coachWorkouts = coaching?.workouts ?? []
  const nextSession = findNextSession(today, coachWorkouts, plannedWorkouts, trainingZones)
  const sessionKinds = plannedSessionKinds(weekTarget.days.map((day) => day.date), coachWorkouts, plannedWorkouts)
  const heroWorkout = todayWorkout && heroWorkoutView(todayWorkout)

  const phaseRanges = getTrainingPlan()?.ranges ?? []
  const card = sessionCard(today, heroWorkout, todayActivity, nextSession, {
    phaseOn: (date) => planPhaseLine(coaching?.plan ?? null, phaseRanges, date)?.phase ?? null,
    hrCapOf: (workout) => sessionHrCapBpm(workout?.hr, athlete.hrZoneBoundsBpm),
  })
  const heat = card?.date === today && card.workout ? await getHeatAhead(today, card.workout.scheduledTime) : null

  return (
    <div className="flex flex-col gap-3">
      <CelebrationOverlay record={mostRecentRecord} milestone={getReturnProgress(today)?.milestones.at(-1) ?? null} aiTake={celebrationTake} />

      <DashboardGreeting name={athlete.displayName} lastSyncedAt={lastSyncedAt} today={today} />
      <StaleSyncBanner lastSyncedAt={lastSyncedAt} />

      <ReadinessCard
        status={trainingStatus}
        verdict={aiVerdict}
        load={recentLoad?.reading ?? null}
        reason={readinessReason(today, coachWorkouts, plannedWorkouts, data.recentActivities, nextSession)}
        yesterdayRun={yesterdayRun(today)}
        today={today}
      />
      <TodayBoard session={card && { ...card, heat }} />
      <CheckInCard today={today}>
        <Vo2GradeTodayRow view={getVo2Grade(today)} />

        <ThisWeekCard target={weekTarget} today={today} sessionKinds={sessionKinds} />
      </CheckInCard>
    </div>
  )
}
