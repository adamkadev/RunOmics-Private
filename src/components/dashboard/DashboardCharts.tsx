'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { WeeklyVolume, TypeDistribution } from '@/domain/activity/types'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import { t } from '@/i18n'

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

const TrainingLoadChartLazy = dynamic(
  () => import('./TrainingLoadChart').then(m => m.TrainingLoadChart),
  { ssr: false, loading: () => <Skeleton h={240} /> }
)

interface Props {
  weeklyVolume: WeeklyVolume[]
  currentWeek: number
  typeDistribution: TypeDistribution[]
  trainingLoad: TrainingLoadData | null
}

export function DashboardCharts({ weeklyVolume, currentWeek, typeDistribution, trainingLoad }: Props) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyVolumeChartLazy data={weeklyVolume} currentWeek={currentWeek} />
        <IntensityChartLazy data={typeDistribution} />
      </div>
      {trainingLoad && <TrainingLoadChartLazy data={trainingLoad} />}
      <Link
        href="/analytics"
        className="flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.dashboard.viewAnalytics} <ArrowRight size={16} />
      </Link>
    </>
  )
}
