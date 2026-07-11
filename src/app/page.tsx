import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getLatestVO2max, getVO2maxTrend } from '@/application/usecases/GetVO2maxHistory'
import { getConsistencyScore } from '@/application/usecases/GetConsistencyScore'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getRecords, getQualifiedEffortsByActivityId, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getFormProjection } from '@/application/usecases/GetFormProjection'
import { getWeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getCurrentWeeklyGoal } from '@/application/usecases/GetGoalsData'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { ConsistencyCard } from '@/components/dashboard/ConsistencyCard'
import { DashboardHighlights } from '@/components/dashboard/DashboardHighlights'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { TrainingMetricsCard } from '@/components/dashboard/TrainingMetricsCard'
import { WeeklyStreakCard } from '@/components/dashboard/WeeklyStreakCard'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import { FirstLaunchHint } from '@/components/dashboard/FirstLaunchHint'
import { RaceCockpit } from '@/components/dashboard/RaceCockpit'
import { WeeklyDigest } from '@/components/dashboard/WeeklyDigest'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the pbs/athlete Firestore collections are written.
export const revalidate = 86400

export default async function DashboardPage() {
  const data = getDashboardData()
  const lastSyncedAt = getLastSyncedAt()
  const trainingLoad = await getTrainingLoad()
  const trainingStatus = await getTrainingStatus()
  const vo2max = getLatestVO2max()
  const vo2maxTrend = getVO2maxTrend()
  const consistencyScore = getConsistencyScore()
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

  return (
    <div className="space-y-6">
      <CelebrationOverlay record={mostRecentRecord} />

      <div className="space-y-3">
        <FirstLaunchHint />
        <DashboardGreeting />
        <DashboardHighlights shoes={shoes} />
      </div>

      <TodayHero
        status={trainingStatus}
        plannedWorkout={todayPlannedWorkout}
        nextRace={nextRace}
        lastSyncedAt={lastSyncedAt}
      />

      <TrainingMetricsCard status={trainingStatus} vo2max={vo2max} vo2maxTrend={vo2maxTrend} />

      {weeklyStreak && (
        <WeeklyStreakCard
          data={weeklyStreak}
          goal={weeklyGoal}
          hardShareFact={weeklyDigest?.review.find((f) => f.key === '8020') ?? null}
        />
      )}

      {(weeklyDigest || consistencyScore) && (
        <div className={weeklyDigest && consistencyScore ? 'grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]' : undefined}>
          {weeklyDigest && <WeeklyDigest data={weeklyDigest} />}
          {consistencyScore && <ConsistencyCard data={consistencyScore} />}
        </div>
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
