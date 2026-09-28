'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'

const ActivityMapDynamic = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-muted" />
  ),
})

interface Props {
  route: [number, number][]
  hoverFraction?: number | null
  className?: string
}

export const ActivityMapClient = memo(function ActivityMapClient({ route, hoverFraction, className }: Props) {
  return (
    <ActivityMapDynamic
      route={route}
      hoverFraction={hoverFraction}
      className={className}
    />
  )
})

