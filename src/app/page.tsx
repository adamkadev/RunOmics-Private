import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getRecords, getQualifiedEffortsByActivityId, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getFormProjection } from '@/application/usecases/GetFormProjection'
import { getWeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { isoDate } from '@/lib/calendarDate'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getCurrentWeeklyGoal } from '@/application/usecases/GetGoalsData'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { DashboardHighlights } from '@/components/dashboard/DashboardHighlights'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { TrainingMetricsCard } from '@/components/dashboard/TrainingMetricsCard'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { FirstLaunchHint } from '@/components/dashboard/FirstLaunchHint'
import { RaceCockpit } from '@/components/dashboard/RaceCockpit'

export default async function DashboardPage() {
  const data = getDashboardData()
  const athlete = getAthleteProfile()
  const lastSyncedAt = getLastSyncedAt()
  const trainingLoad = await getTrainingLoad()
  const trainingStatus = await getTrainingStatus()
  const vo2max = getLatestVO2max()
  const heatmapDays = getHeatmapData()
  const records = await getRecords()
  const qualifiedEffortsByActivityId = getQualifiedEffortsByActivityId(records)
  const mostRecentRecord = getMostRecentRecord(records)
  const shoes = getShoeStats()
  const nextRace = await getNextRace()
  const formProjection = await getFormProjection()
  const weeklyDigest = await getWeeklyDigest()
  const todayPlannedWorkout = await getTodayPlannedWorkout()
  const weeklyStreak = getWeeklyStreakData()
  const weeklyGoal = await getCurrentWeeklyGoal()

  // recentActivities is newest-first, so today's run (if already synced) is
  // whatever entry matches today's date - same date-only pairing WeekView uses.
  const today = isoDate(new Date())
  const todayActivity = data.recentActivities.find((a) => a.date === today) ?? null

  return (
    <div className="space-y-6">
      <CelebrationOverlay record={mostRecentRecord} />

      <div className="space-y-3">
        <FirstLaunchHint />
        <DashboardGreeting name={athlete.displayName} />
        <DashboardHighlights shoes={shoes} />
      </div>

      <TodayHero
        status={trainingStatus}
        plannedWorkout={todayPlannedWorkout}
        todayActivity={todayActivity}
        nextRace={nextRace}
        lastSyncedAt={lastSyncedAt}
      />

      <TrainingMetricsCard status={trainingStatus} vo2max={vo2max} age={athlete.age} sex={athlete.sex} />

      {weeklyStreak && (
        <WeeklyStreakCard
          data={weeklyStreak}
          goal={weeklyGoal}
          hardShareFact={weeklyDigest?.review.find((f) => f.key === '8020') ?? null}
        />
      )}

      {formProjection && <RaceCockpit data={formProjection} />}

      <DashboardCharts
        weeklyVolume={data.weeklyVolume}
        currentWeek={data.currentWeek.weekNumber}
        typeDistribution={data.typeDistribution}
        trainingLoad={trainingLoad}
      />

      <ActivityHeatmap days={heatmapDays} />

      <RecentActivities activities={data.recentActivities} qualifiedEffortsByActivityId={qualifiedEffortsByActivityId} />
    </div>
  )
}
