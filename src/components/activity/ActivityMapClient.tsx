'use client'

import dynamic from 'next/dynamic'

const ActivityMapDynamic = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[280px] w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
  ),
})

interface Props {
  route: [number, number][]
  hoverFraction?: number | null
  className?: string
}

export function ActivityMapClient({ route, hoverFraction, className }: Props) {
  return <ActivityMapDynamic route={route} hoverFraction={hoverFraction} className={className} />
}
