'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { ExploreAreaRef } from '@/domain/explore/types'
import type { ExplorePlan } from '@/components/explore/routeGenerator'
import { TerritoryBand, type TerritoryCardContent } from './TerritoryBand'

const GlobalMapClient = dynamic(
  () => import('./GlobalMapClient').then((m) => m.GlobalMapClient),
  {
    ssr: false,
    // The chip row and the map box at their own sizes, so nothing moves when they arrive.
    loading: () => (
      <div className="flex flex-col gap-3.5">
        <div className="mt-1 h-8" />
        <div className="h-[360px] w-full animate-pulse rounded-2xl bg-muted md:h-[560px]" />
      </div>
    ),
  }
)

export function GlobalMapWrapper({
  data,
  exploreAreas,
  explorePlans,
  today,
}: {
  data: MapShellData
  exploreAreas?: ExploreAreaRef[]
  explorePlans?: readonly ExplorePlan[]
  /** 'YYYY-MM-DD', on this device's clock. */
  today?: string
}) {
  const [content, setContent] = useState<TerritoryCardContent | null>(null)

  return (
    <div className="flex flex-col gap-3.5">
      <GlobalMapClient data={data} onContentChange={setContent} exploreAreas={exploreAreas} explorePlans={explorePlans} today={today} />
      {content && <TerritoryBand {...content} />}
    </div>
  )
}
