'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { TerritoryBand, type TerritoryCardContent } from './TerritoryBand'

const GlobalMapClient = dynamic(
  () => import('./GlobalMapClient').then((m) => m.GlobalMapClient),
  { ssr: false, loading: () => <div className="h-[410px] w-full animate-pulse rounded-[22px] bg-muted" /> }
)

// The card sits under the map (v4.8), as its own card rather than inside
// the map's box. GlobalMapClient reports the card's content back up as the
// athlete changes area or filters, so the two never disagree.
export function GlobalMapWrapper({ data }: { data: MapShellData }) {
  const [content, setContent] = useState<TerritoryCardContent | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <GlobalMapClient data={data} onContentChange={setContent} />
      {content && <TerritoryBand {...content} />}
    </div>
  )
}
