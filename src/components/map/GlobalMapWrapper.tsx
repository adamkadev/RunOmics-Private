'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { ExploreAreaRef } from '@/domain/explore/types'
import type { ExplorePlan } from '@/components/explore/routeGenerator'
import { t } from '@/i18n'
import { TerritoryBand, type TerritoryCardContent } from './TerritoryBand'
import { clusterTracks, mapShell } from './mapData'

// The chip row and the map box at their own sizes, so nothing moves when they arrive.
function MapSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="mt-1 h-8" />
      <div className="h-[360px] w-full animate-pulse rounded-2xl bg-muted md:h-[560px]" />
    </div>
  )
}

const GlobalMapClient = dynamic(() => import('./GlobalMapClient').then((m) => m.GlobalMapClient), { ssr: false, loading: MapSkeleton })

export function GlobalMapWrapper({
  version,
  clusterId,
  exploreAreas,
  explorePlans,
  completedSince,
  today,
}: {
  /** The map data's version: what its answers are cached under. */
  version: string
  /** The cluster the map opens on, fetched alongside the shell. */
  clusterId: string | null
  exploreAreas?: ExploreAreaRef[]
  explorePlans?: readonly ExplorePlan[]
  completedSince?: Record<string, string>
  /** 'YYYY-MM-DD', on this device's clock. */
  today?: string
}) {
  const [content, setContent] = useState<TerritoryCardContent | null>(null)
  const [shell, setShell] = useState<{ version: string; data: MapShellData | null } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    if (clusterId !== null) void clusterTracks(version, clusterId)
    void mapShell(version).then((data) => {
      if (live) setShell({ version, data })
    })
    return () => {
      live = false
    }
  }, [version, clusterId, attempt])

  if (shell?.version !== version) return <MapSkeleton />
  if (!shell.data) {
    return (
      <div className="flex h-[360px] flex-col items-center justify-center gap-3 rounded-2xl bg-muted text-sm text-muted-foreground md:h-[560px]" role="status">
        {t.pages.map.loadFailed}
        <button
          type="button"
          className="hit-44 font-semibold text-accent-text"
          onClick={() => {
            setShell(null)
            setAttempt((n) => n + 1)
          }}
        >
          {t.pages.error.retry}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <GlobalMapClient
        data={shell.data}
        version={version}
        onContentChange={setContent}
        exploreAreas={exploreAreas}
        explorePlans={explorePlans}
        completedSince={completedSince}
        today={today}
      />
      {content && <TerritoryBand {...content} />}
    </div>
  )
}
