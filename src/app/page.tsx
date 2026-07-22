import Link from 'next/link'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTrainingStatusWeeks } from '@/application/usecases/GetTrainingStatusWeeks'
import { getRecords, getQualifiedEffortsByActivityId, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getWeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { isoDate } from '@/lib/calendarDate'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getCurrentWeeklyGoal } from '@/application/usecases/GetGoalsData'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { FormFitnessFatigueTrio } from '@/components/dashboard/FormFitnessFatigueTrio'
import { TrainingStatusWeeksBar } from '@/components/dashboard/TrainingStatusWeeksBar'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { FirstLaunchHint } from '@/components/dashboard/FirstLaunchHint'
import { t } from '@/i18n'

export const revalidate = 3600

// Today answers one question - "what should I do today?" - in five blocks:
// header, readiness hero, Form/Fitness/Fatigue trio, the 4-week training-status
// strip, the week goal, and recent runs. Everything else (form-projection and
// volume charts, VO2max, the 12-month heatmap) lives on Analytics and Progress.
export default async function DashboardPage() {
  const data = getDashboardData()
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingLoad = await getTrainingLoad()
  const trainingStatus = await getTrainingStatus()
  const trainingStatusWeeks = getTrainingStatusWeeks()
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const mostRecentRecord = getMostRecentRecord(records)
  const nextRace = await getNextRace()
  const weeklyDigest = await getWeeklyDigest()
  const todayPlannedWorkout = await getTodayPlannedWorkout()
  const weeklyStreak = getWeeklyStreakData()
  const weeklyGoal = await getCurrentWeeklyGoal()

  // recentActivities is newest-first, so today's run (if already synced) is
  // whatever entry matches today's date - same date-only pairing WeekView uses.
  const today = isoDate(new Date())
  const todayActivity = data.recentActivities.find((a) => a.date === today) ?? null

  return (
    <div className="space-y-3.5">
      <CelebrationOverlay record={mostRecentRecord} />

      <div className="space-y-3">
        <FirstLaunchHint />
        <DashboardGreeting name={athlete.displayName} />
      </div>

      <TodayHero
        status={trainingStatus}
        plannedWorkout={todayPlannedWorkout}
        todayActivity={todayActivity}
        nextRace={nextRace}
        lastSyncedAt={lastSyncedAt}
      />

      <FormFitnessFatigueTrio status={trainingStatus} load={trainingLoad} />

      <TrainingStatusWeeksBar weeks={trainingStatusWeeks} />

      {weeklyStreak && (
        // The week glance folds the retired Plan tab into Today: it taps
        // through to the full planner.
        <Link href="/plan" aria-label={t.plan.openPlanner} className="block active:scale-[0.99]">
          <WeeklyStreakCard
            data={weeklyStreak}
            goal={weeklyGoal}
            hardShareFact={weeklyDigest?.review.find((f) => f.key === '8020') ?? null}
          />
        </Link>
      )}

      <RecentActivities
        activities={data.recentActivities.slice(0, 3)}
        qualifiedEffortsByActivityId={qualifiedEffortsByActivityId}
      />
    </div>
  )
}
