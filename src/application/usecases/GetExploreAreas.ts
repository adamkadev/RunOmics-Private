import { createHash } from 'node:crypto'
import { listExploreAreas, readExploreAreaFile, type ExploreAreaFileRead } from '@/infrastructure/repositories/JsonExploreAreaRepository'
import { areaForCluster } from '@/domain/explore/areaForCluster'
import type { ExploreAreaRef } from '@/domain/explore/types'
import { getMapShellData } from './GetAllRoutes'

/** One run of the home cluster, as the coverage worker asks for its track. */
export interface ExploreRun {
  /** Index into `routeMeta` and the `/api/map/routes` answer. Not stable across deployments. */
  routeIdx: number
  /** The activity id: what anything cached is keyed by. */
  id: string
  /** 'YYYY-MM-DD' */
  date: string
}

/** What a page needs to start Explore without fetching anything first. */
export interface ExploreHome {
  area: ExploreAreaRef
  clusterId: string
  runs: ExploreRun[]
  /**
   * Changes when, and only when, the set of runs does. Route indices and
   * cluster ids both shift when a run is added, and the build commit stays
   * the same across a data-only redeploy, so neither can key a cache.
   */
  dataVersion: string
}

export function getExploreAreas(): ExploreAreaRef[] {
  return listExploreAreas()
}

export function getExploreAreaFile(id: string): ExploreAreaFileRead | null {
  return readExploreAreaFile(id)
}

/** Short and stable: a cache key, not a signature. */
function runsVersion(ids: string[]): string {
  return createHash('sha256').update([...ids].sort().join('\n')).digest('hex').slice(0, 12)
}

/**
 * Explore for the cluster the map opens on, or null when this deployment has
 * no area for it - a city nobody built areas for, or a cluster outside
 * France - so the page leaves the Districts layer and its entry points out.
 */
export function getExploreHome(): ExploreHome | null {
  const areas = listExploreAreas()
  if (areas.length === 0) return null

  const { clusters, defaultClusterIdx, routeMeta } = getMapShellData()
  const cluster = clusters[defaultClusterIdx]
  if (!cluster) return null

  const area = areaForCluster(areas, cluster)
  if (!area) return null

  const runs = cluster.routeIndices.flatMap((routeIdx) => {
    const meta = routeMeta[routeIdx]
    return meta ? [{ routeIdx, id: meta.id, date: meta.date.slice(0, 10) }] : []
  })

  return { area, clusterId: cluster.id, runs, dataVersion: runsVersion(runs.map((run) => run.id)) }
}
