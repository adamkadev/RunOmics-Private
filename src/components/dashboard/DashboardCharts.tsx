'use client'

import dynamic from 'next/dynamic'
import type { WeeklyVolume, TypeDistribution } from '@/domain/activity/types'

function Skeleton({ h = 200 }: { h?: number }) {
  return <div className="animate-pulse rounded-xl bg-muted" style={{ height: h }} />
}

const WeeklyVolumeChartLazy = dynamic(
  () => import('./WeeklyVolumeChart').then(m => m.WeeklyVolumeChart),
  { ssr: false, loading: () => <Skeleton /> }
)

const IntensityChartLazy = dynamic(
  () => import('./IntensityChart').then(m => m.IntensityChart),
  { ssr: false, loading: () => <Skeleton /> }
)

interface Props {
  weeklyVolume: WeeklyVolume[]
  currentWeek: number
  typeDistribution: TypeDistribution[]
}

export function DashboardCharts({ weeklyVolume, currentWeek, typeDistribution }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <WeeklyVolumeChartLazy data={weeklyVolume} currentWeek={currentWeek} />
      <IntensityChartLazy data={typeDistribution} />
    </div>
  )
}
