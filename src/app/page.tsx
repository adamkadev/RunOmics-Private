import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getConsistencyScore } from '@/application/usecases/GetConsistencyScore'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getRecords, getPrLabelsByActivityId } from '@/application/usecases/GetRecords'
import { getPbAlerts } from '@/application/usecases/GetPbAlerts'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { TrainingStatusBanner } from '@/components/dashboard/TrainingStatusBanner'
import { ConsistencyCard } from '@/components/dashboard/ConsistencyCard'
import { PbAlertLine } from '@/components/ui/PbAlertLine'
import { t } from '@/i18n'

export default async function DashboardPage() {
  const data = getDashboardData()
  const trainingLoad = getTrainingLoad()
  const trainingStatus = getTrainingStatus()
  const consistencyScore = getConsistencyScore()
  const heatmapDays = getHeatmapData()
  const vo2max = getLatestVO2max()
  const records = await getRecords()
  const prLabelsByActivityId = getPrLabelsByActivityId(records)
  const pbAlerts = await getPbAlerts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.dashboard.title}</h1>
      </div>

      <PbAlertLine alerts={pbAlerts} />

      <StatsGrid
        weeks={data.weeks}
        currentStreak={data.currentStreak}
        vo2max={vo2max}
      />

      {(trainingStatus || consistencyScore) && (
        <div className={trainingStatus && consistencyScore ? 'grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]' : undefined}>
          {trainingStatus && <TrainingStatusBanner status={trainingStatus} />}
          {consistencyScore && <ConsistencyCard data={consistencyScore} />}
        </div>
      )}

      <DashboardCharts
        weeklyVolume={data.weeklyVolume}
        currentWeek={data.currentWeek.weekNumber}
        typeDistribution={data.typeDistribution}
        trainingLoad={trainingLoad}
      />

      <ActivityHeatmap days={heatmapDays} />

      <RecentActivities activities={data.recentActivities} prLabelsByActivityId={prLabelsByActivityId} />
    </div>
  )
}
