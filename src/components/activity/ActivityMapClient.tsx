'use client'

import { memo, type ReactNode } from 'react'
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
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  overlay?: ReactNode
  card?: ReactNode
}

export const ActivityMapClient = memo(function ActivityMapClient({ route, hoverFraction, className, fullscreen, onFullscreenChange, overlay, card }: Props) {
  return (
    <ActivityMapDynamic
      route={route}
      hoverFraction={hoverFraction}
      className={className}
      fullscreen={fullscreen}
      onFullscreenChange={onFullscreenChange}
      overlay={overlay}
      card={card}
    />
  )
})
