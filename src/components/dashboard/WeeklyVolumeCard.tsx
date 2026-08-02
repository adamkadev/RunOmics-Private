'use client'

import dynamic from 'next/dynamic'
import type { WeeklyVolumePoint } from '@/application/usecases/GetWeeklyVolume'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'

// Recharts is the heaviest thing the dashboard would pull, and this is the only
// chart on it - loaded on the client, below the fold, so the landing screen
// still parses just the hero and the stat cards.
const WeeklyVolumeChart = dynamic(
  () => import('./WeeklyVolumeChart').then((m) => m.WeeklyVolumeChart),
  { ssr: false, loading: () => <ChartCardSkeleton /> }
)

export function WeeklyVolumeCard({ points }: { points: WeeklyVolumePoint[] }) {
  return <WeeklyVolumeChart points={points} />
}
