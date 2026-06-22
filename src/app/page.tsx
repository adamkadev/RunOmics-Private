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
import { DashboardFocusProvider } from '@/components/dashboard/DashboardFocusContext'
import { DashboardFocusBar } from '@/components/dashboard/DashboardFocusBar'
import { DashboardWidgets, type DashboardWidget } from '@/components/dashboard/DashboardWidgets'
import { t } from '@/i18n'

export const revalidate = 60

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

  const trainingOverviewWidget: DashboardWidget = {
    id: 'trainingOverview',
    element: (
      <div className={trainingStatus && consistencyScore ? 'grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]' : undefined}>
        {trainingStatus && <TrainingStatusBanner status={trainingStatus} />}
        {consistencyScore && <ConsistencyCard data={consistencyScore} />}
      </div>
    ),
  }

  const widgets: DashboardWidget[] = [
    {
      id: 'stats',
      element: <StatsGrid weeks={data.weeks} currentStreak={data.currentStreak} vo2max={vo2max} weekLoad={weekLoad} />,
    },
    ...(trainingStatus || consistencyScore ? [trainingOverviewWidget] : []),
    {
      id: 'charts',
      element: (
        <DashboardCharts
          weeklyVolume={data.weeklyVolume}
          currentWeek={data.currentWeek.weekNumber}
          typeDistribution={data.typeDistribution}
          trainingLoad={trainingLoad}
        />
      ),
    },
    { id: 'heatmap', element: <ActivityHeatmap days={heatmapDays} /> },
    {
      id: 'recentActivities',
      element: <RecentActivities activities={data.recentActivities} prLabelsByActivityId={prLabelsByActivityId} />,
    },
  ]

  return (
    <DashboardFocusProvider>
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-display text-foreground">{t.pages.dashboard.title}</h1>
          <DashboardHighlights
            record={mostRecentRecord}
            pbAlerts={pbAlerts}
            shoes={shoes}
            nextRace={nextRace}
          />
        </div>

        <div className="flex justify-end">
          <DashboardFocusBar />
        </div>

        <DashboardWidgets widgets={widgets} />
      </div>
    </DashboardFocusProvider>
  )
}
