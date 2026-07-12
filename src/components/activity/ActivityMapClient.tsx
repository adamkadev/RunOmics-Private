'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'

const ActivityMapDynamic = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[280px] w-full animate-pulse rounded-xl bg-muted" />
  ),
})

import type { ActivityType } from '@/domain/activity/types'

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  avgTemperature?: number | null
  activityType?: ActivityType | null
  gearId?: string | null
  className?: string
}

export const ActivityMapClient = memo(function ActivityMapClient({ route, paceSamples, hoverFraction, avgTemperature, activityType, gearId, className }: Props) {
  return (
    <ActivityMapDynamic
      route={route}
      paceSamples={paceSamples}
      hoverFraction={hoverFraction}
      avgTemperature={avgTemperature}
      activityType={activityType}
      gearId={gearId}
      className={className}
    />
  )
})
