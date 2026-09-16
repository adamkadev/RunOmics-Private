import Link from 'next/link'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTrainingStatusDaysBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { getRecords, getQualifiedEffortsByActivityId, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getTodayInsight } from '@/application/usecases/GetTodayInsight'
import { getPbCelebrationInsight } from '@/application/usecases/GetPbCelebrationInsight'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { coachWorkoutView, plannedWorkoutView } from '@/components/plan/planWorkoutView'
import { isoDate } from '@/lib/calendarDate'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getCurrentWeeklyGoal } from '@/application/usecases/GetGoalsData'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { FormFitnessFatigueTrio } from '@/components/dashboard/FormFitnessFatigueTrio'
import { TrainingStatusDaysBar } from '@/components/dashboard/TrainingStatusDaysBar'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function DashboardPage() {
  const data = getDashboardData()
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingLoad = await getTrainingLoad()
  const trainingStatus = await getTrainingStatus()
  const trainingStatusDays = getTrainingStatusDaysBar()
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const mostRecentRecord = getMostRecentRecord(records)
  const nextRace = await getNextRace()
  const todayPlannedWorkout = await getTodayPlannedWorkout()
  const weeklyStreak = getWeeklyStreakData()
  const weeklyGoal = await getCurrentWeeklyGoal()
  const coaching = getCoachingOverview()

  const today = isoDate(new Date())
  const todayActivity = data.recentActivities.find((a) => a.date === today) ?? null
  const todayCoachWorkout = coaching?.workouts.find((workout) => workout.prescription.date === today && workout.prescription.status !== 'cancelled') ?? null
  const trainingZones = await getTrainingZones()
  const todayWorkout = todayCoachWorkout
    ? coachWorkoutView(todayCoachWorkout, trainingZones, todayPlannedWorkout)
    : todayPlannedWorkout
      ? plannedWorkoutView(todayPlannedWorkout, trainingZones)
      : null
  const aiVerdict = todayCoachWorkout ? null : await getTodayInsight(trainingStatus, todayPlannedWorkout)
  const celebrationTake = await getPbCelebrationInsight(mostRecentRecord)

  return (
    <div className="space-y-3.5">
      <CelebrationOverlay record={mostRecentRecord} aiTake={celebrationTake} />

      <DashboardGreeting name={athlete.displayName} lastSyncedAt={lastSyncedAt} />

      <TodayHero
        status={trainingStatus}
        plannedWorkout={todayWorkout}
        todayActivity={todayActivity}
        nextRace={nextRace}
        aiVerdict={aiVerdict}
      />

      <FormFitnessFatigueTrio status={trainingStatus} load={trainingLoad} />

      <TrainingStatusDaysBar days={trainingStatusDays} />

      {weeklyStreak && (
        <Link href="/plan" aria-label={t.plan.openPlanner} className="block active:scale-[0.99]">
          <WeeklyStreakCard data={weeklyStreak} goal={weeklyGoal} />
        </Link>
      )}

      <RecentActivities
        activities={data.recentActivities.slice(0, 3)}
        qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      />
    </div>
  )
}
