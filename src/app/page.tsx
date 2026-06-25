import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getConsistencyScore } from '@/application/usecases/GetConsistencyScore'
import { getWeeklyLoadComparison } from '@/application/usecases/GetWeeklyLoadComparison'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getRecords, getPrLabelsByActivityId, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getPbAlerts } from '@/application/usecases/GetPbAlerts'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { TrainingStatusBanner } from '@/components/dashboard/TrainingStatusBanner'
import { ConsistencyCard } from '@/components/dashboard/ConsistencyCard'
import { DashboardHighlights } from '@/components/dashboard/DashboardHighlights'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'

export default async function DashboardPage() {
  const data = getDashboardData()
  const trainingLoad = getTrainingLoad()
  const trainingStatus = getTrainingStatus()
  const consistencyScore = getConsistencyScore()
  const weekLoad = getWeeklyLoadComparison()
  const heatmapDays = getHeatmapData()
  const vo2max = getLatestVO2max()
  const records = await getRecords()
  const prLabelsByActivityId = getPrLabelsByActivityId(records)
  const mostRecentRecord = getMostRecentRecord(records)
  const pbAlerts = await getPbAlerts()
  const shoes = getShoeStats()
  const nextRace = await getNextRace()

  return (
    <div className="space-y-6">
      <div className="space-y-3">        
        <DashboardGreeting />
        <DashboardHighlights
          record={mostRecentRecord}
          pbAlerts={pbAlerts}
          shoes={shoes}
          nextRace={nextRace}
        />
      </div>

      <StatsGrid weeks={data.weeks} currentStreak={data.currentStreak} vo2max={vo2max} weekLoad={weekLoad} />

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
