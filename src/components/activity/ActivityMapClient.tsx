'use client'

import dynamic from 'next/dynamic'

const ActivityMapDynamic = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[280px] w-full animate-pulse rounded-xl bg-muted" />
  ),
})

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  avgTemperature?: number | null
  className?: string
}

export function ActivityMapClient({ route, paceSamples, hoverFraction, avgTemperature, className }: Props) {
  return (
    <ActivityMapDynamic
      route={route}
      paceSamples={paceSamples}
      hoverFraction={hoverFraction}
      avgTemperature={avgTemperature}
      className={className}
    />
  )
}
