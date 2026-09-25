'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'

const ActivityMapDynamic = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-xl bg-muted" />
  ),
})

import type { ActivityWeather } from '@/domain/activity/types'

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  weather?: ActivityWeather | null
  className?: string
}

export const ActivityMapClient = memo(function ActivityMapClient({ route, paceSamples, hoverFraction, weather, className }: Props) {
  return (
    <ActivityMapDynamic
      route={route}
      paceSamples={paceSamples}
      hoverFraction={hoverFraction}
      weather={weather}
      className={className}
    />
  )
})
