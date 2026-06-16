import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getConsistencyScore } from '@/application/usecases/GetConsistencyScore'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getInsights } from '@/application/usecases/GetInsights'
import { getInsightsSnapshot } from '@/application/usecases/GetInsightsSnapshot'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { InsightsCard } from '@/components/dashboard/InsightsCard'
import { AiInsightsCard } from '@/components/dashboard/AiInsightsCard'
import { TrainingStatusBanner } from '@/components/dashboard/TrainingStatusBanner'
import { ConsistencyCard } from '@/components/dashboard/ConsistencyCard'
import { t } from '@/i18n'

export default function DashboardPage() {
  const data = getDashboardData()
  const trainingLoad = getTrainingLoad()
  const trainingStatus = getTrainingStatus()
  const consistencyScore = getConsistencyScore()
  const heatmapDays = getHeatmapData()
  const insights = getInsights()
  const insightsSnapshot = getInsightsSnapshot()
  const vo2max = getLatestVO2max()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.dashboard.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t.pages.dashboard.subtitle(data.currentWeek.weekNumber % 100, data.currentWeek.sessionCount)}
        </p>
      </div>

      <StatsGrid
        currentWeek={data.currentWeek}
        lastWeek={data.lastWeek}
        currentStreak={data.currentStreak}
        longestStreak={data.longestStreak}
        vo2max={vo2max}
      />

      {(trainingStatus || consistencyScore) && (
        <div className={trainingStatus && consistencyScore ? 'grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]' : undefined}>
          {trainingStatus && <TrainingStatusBanner status={trainingStatus} />}
          {consistencyScore && <ConsistencyCard data={consistencyScore} />}
        </div>
      )}

      {insightsSnapshot ? <AiInsightsCard snapshot={insightsSnapshot} /> : <InsightsCard insights={insights} />}

      <DashboardCharts
        weeklyVolume={data.weeklyVolume}
        currentWeek={data.currentWeek.weekNumber}
        typeDistribution={data.typeDistribution}
        trainingLoad={trainingLoad}
      />

      <ActivityHeatmap days={heatmapDays} />

      <RecentActivities activities={data.recentActivities} />
    </div>
  )
}
