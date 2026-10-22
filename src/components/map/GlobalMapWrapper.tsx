'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { ExploreAreaRef } from '@/domain/explore/types'
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

// The card sits under the map (v4.8, v4.17), as its own card rather than
// inside the map's box. GlobalMapClient reports the card's content back up as the
// athlete changes area or filters, so the two never disagree.
export function GlobalMapWrapper({ data, exploreAreas }: { data: MapShellData; exploreAreas?: ExploreAreaRef[] }) {
  const [content, setContent] = useState<TerritoryCardContent | null>(null)

  return (
    <div className="flex flex-col gap-3.5">
      <GlobalMapClient data={data} onContentChange={setContent} exploreAreas={exploreAreas} />
      {content && <TerritoryBand {...content} />}
    </div>
  )
}
