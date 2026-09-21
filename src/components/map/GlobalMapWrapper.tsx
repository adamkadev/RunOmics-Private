'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { TerritoryBand } from './TerritoryBand'

const GlobalMapClient = dynamic(
  () => import('./GlobalMapClient').then((m) => m.GlobalMapClient),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
)

interface Stat {
  value: string
  label: string
}

export interface TerritoryCardContent {
  eyebrow: string
  headline: string
  primaryStat: Stat
  secondaryStat: Stat
}

// The territory card lives here, a sibling to the bordered map box rather
// than inside it, so it keeps its own card shell instead of fusing with the
// map's rounded corners. GlobalMapClient reports the card's content back up
// as the athlete changes cluster, filters or zoom level, so the two never
// disagree - including at world zoom, where "all areas" is itself a state
// the card has to name.
export function GlobalMapWrapper({ data }: { data: MapShellData }) {
  const [content, setContent] = useState<TerritoryCardContent | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {content && <TerritoryBand {...content} />}
      <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-card">
        <GlobalMapClient data={data} onContentChange={setContent} />
      </div>
    </div>
  )
}
