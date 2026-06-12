import { getDashboardData } from '@/application/usecases/GetDashboardData'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { WeeklyVolumeChart } from '@/components/dashboard/WeeklyVolumeChart'
import { IntensityChart } from '@/components/dashboard/IntensityChart'
import { RecentActivities } from '@/components/dashboard/RecentActivities'

export default function DashboardPage() {
  const data = getDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Week {data.currentWeek.weekNumber} · {data.currentWeek.sessionCount} sessions
        </p>
      </div>

      <StatsGrid currentWeek={data.currentWeek} lastWeek={data.lastWeek} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyVolumeChart data={data.weeklyVolume} currentWeek={data.currentWeek.weekNumber} />
        <IntensityChart data={data.typeDistribution} />
      </div>

      <RecentActivities activities={data.recentActivities} />
    </div>
  )
}
