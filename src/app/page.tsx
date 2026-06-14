import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getVO2max } from '@/application/usecases/GetRecords'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { t } from '@/i18n'

export default function DashboardPage() {
  const data = getDashboardData()
  const trainingLoad = getTrainingLoad()
  const vo2max = getVO2max()
  const heatmapDays = getHeatmapData()

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
