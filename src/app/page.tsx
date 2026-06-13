import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getVO2max } from '@/application/usecases/GetRecords'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { WeeklyVolumeChart } from '@/components/dashboard/WeeklyVolumeChart'
import { IntensityChart } from '@/components/dashboard/IntensityChart'
import { TrainingLoadChart } from '@/components/dashboard/TrainingLoadChart'
import { RecentActivities } from '@/components/dashboard/RecentActivities'

export default function DashboardPage() {
  const data = getDashboardData()
  const trainingLoad = getTrainingLoad()
  const vo2max = getVO2max()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Week {data.currentWeek.weekNumber % 100} · {data.currentWeek.sessionCount} sessions
        </p>
      </div>

      <StatsGrid
        currentWeek={data.currentWeek}
        lastWeek={data.lastWeek}
        currentStreak={data.currentStreak}
        longestStreak={data.longestStreak}
        vo2max={vo2max}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyVolumeChart data={data.weeklyVolume} currentWeek={data.currentWeek.weekNumber} />
        <IntensityChart data={data.typeDistribution} />
      </div>

      {trainingLoad && <TrainingLoadChart data={trainingLoad} />}

      <RecentActivities activities={data.recentActivities} />
    </div>
  )
}
