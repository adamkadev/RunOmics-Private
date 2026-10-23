'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AreaCoverage, ExploreAreaFile, ExploreAreaRef } from '@/domain/explore/types'
import { getExploreEngine, type ExploreEngine } from './exploreEngine'
import { flattenTracks } from './trackBuffers'
import { areaKey } from './workerProtocol'

export type DistrictsStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DistrictsCoverageInput {
  /** Only then does anything run: Heat users never start the worker. */
  enabled: boolean
  area: ExploreAreaRef | null
  /** The map's sparse routes, by global route index. */
  routes: readonly ([number, number][] | undefined)[]
  /** What is sent to the worker once loaded. */
  clusterIndices: readonly number[]
  /** The runs the heat filters keep: what coverage counts. */
  visibleIndices: readonly number[]
  routeMeta: readonly ({ id: string; date: string } | undefined)[]
  /** The unfiltered median start. */
  home: [number, number] | null
}

export interface DistrictsCoverage {
  area: ExploreAreaFile | null
  coverage: AreaCoverage | null
  status: DistrictsStatus
}

interface Settled {
  /** The inputs this answer is for. */
  key: string
  areaKey: string
  coverage: AreaCoverage | null
  failed: boolean
}

/** While a new answer is on its way the last one for the same area stays, so the map doesn't flash empty between filters. */
export function useDistrictsCoverage(
  input: DistrictsCoverageInput,
  engineFor: () => ExploreEngine = getExploreEngine,
): DistrictsCoverage {
  const { enabled, area, routes, clusterIndices, visibleIndices, routeMeta, home } = input
  const currentArea = area ? areaKey(area) : null

  const loaded = useMemo(() => clusterIndices.filter((i) => !!routes[i]?.length && !!routeMeta[i]), [clusterIndices, routes, routeMeta])
  const activityIds = useMemo(
    () => visibleIndices.flatMap((i) => (routeMeta[i] ? [routeMeta[i]!.id] : [])),
    [visibleIndices, routeMeta],
  )
  const homeKey = home ? `${home[0]},${home[1]}` : ''
  const requestKey = `${currentArea}|${loaded.length}|${activityIds.join(',')}|${homeKey}`

  const [file, setFile] = useState<{ key: string; area: ExploreAreaFile } | null>(null)
  const [settled, setSettled] = useState<Settled | null>(null)
  const latest = useRef(0)
  // Read in the effect, which keys on requestKey: the strings it is built from.
  const inputs = useRef({ area, routes, loaded, activityIds, home, routeMeta })
  useEffect(() => {
    inputs.current = { area, routes, loaded, activityIds, home, routeMeta }
  })

  useEffect(() => {
    if (!enabled || !currentArea) return
    const request = ++latest.current
    const stale = () => request !== latest.current
    const { area: ref, routes: tracks, loaded: runs, activityIds: ids, home: from, routeMeta: meta } = inputs.current
    if (!ref) return
    const engine = engineFor()

    void (async () => {
      try {
        const areaFile = await engine.loadArea(ref)
        if (stale()) return
        setFile((prev) => (prev?.key === currentArea && prev.area === areaFile ? prev : { key: currentArea, area: areaFile }))
        // The cluster's tracks are still on their way: coverage of no run would be all fog.
        if (runs.length === 0) return

        const unsent = new Set(engine.unsent(ref, runs.map((i) => meta[i]!.id)))
        const toSend = runs.filter((i) => unsent.has(meta[i]!.id))
        if (toSend.length > 0) await engine.addTracks(ref, flattenTracks(tracks, toSend, meta))
        if (stale()) return

        const coverage = await engine.coverage(ref, { activityIds: ids, home: from })
        if (stale()) return
        setSettled({ key: requestKey, areaKey: currentArea, coverage, failed: false })
      } catch (err) {
        if (stale()) return
        console.warn('Districts coverage failed', err)
        setSettled((prev) => ({ key: requestKey, areaKey: currentArea, coverage: prev?.areaKey === currentArea ? prev.coverage : null, failed: true }))
      }
    })()
  }, [enabled, currentArea, requestKey, engineFor])

  const active = enabled && !!currentArea
  const shownArea = active && file?.key === currentArea ? file.area : null
  const shownCoverage = active && settled?.areaKey === currentArea ? settled.coverage : null
  const status: DistrictsStatus = !active ? 'idle' : settled?.key === requestKey ? (settled.failed ? 'error' : 'ready') : 'loading'
  // One object per answer, so a card built from it changes only when it does.
  return useMemo(() => ({ area: shownArea, coverage: shownCoverage, status }), [shownArea, shownCoverage, status])
}
