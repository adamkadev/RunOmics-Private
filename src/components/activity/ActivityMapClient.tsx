'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'

const ActivityMapDynamic = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[280px] w-full animate-pulse rounded-xl bg-muted" />
  ),
})

import type { ActivityType, ActivityWeather } from '@/domain/activity/types'
import type { ShoeTag } from '@/domain/shoe/types'

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  weather?: ActivityWeather | null
  activityType?: ActivityType | null
  shoe?: ShoeTag | null
  className?: string
}

export const ActivityMapClient = memo(function ActivityMapClient({ route, paceSamples, hoverFraction, weather, activityType, shoe, className }: Props) {
  return (
    <ActivityMapDynamic
      route={route}
      paceSamples={paceSamples}
      hoverFraction={hoverFraction}
      weather={weather}
      activityType={activityType}
      shoe={shoe}
      className={className}
    />
  )
})
