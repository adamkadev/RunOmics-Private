import { createHash } from 'node:crypto'
import { listExploreAreas, readExploreAreaFile, type ExploreAreaFileRead } from '@/infrastructure/repositories/JsonExploreAreaRepository'
import { areaForCluster } from '@/domain/explore/areaForCluster'
import type { ExploreAreaRef } from '@/domain/explore/types'
import { getMapShellData } from './GetAllRoutes'

export interface ExploreRun {
  /** Index into `routeMeta` and the `/api/map/routes` answer. Not stable across deployments. */
  routeIdx: number
  /** The activity id: what anything cached is keyed by. */
  id: string
  /** 'YYYY-MM-DD' */
  date: string
}

export interface ExploreHome {
  area: ExploreAreaRef
  clusterId: string
  runs: ExploreRun[]
  /**
   * Changes when, and only when, the set of runs does: route indices and cluster
   * ids shift when a run is added, and the build commit survives a data-only redeploy.
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
 * One per area the runs fall in, from the busiest cluster in it, as the map opens it: a second
 * cluster in the same area is left out there too. Busiest first, so the first is the home.
 */
export function getExploreHomes(): ExploreHome[] {
  const areas = listExploreAreas()
  if (areas.length === 0) return []

  const { clusters, routeMeta } = getMapShellData()
  const homes: ExploreHome[] = []
  for (const cluster of clusters) {
    const area = areaForCluster(areas, cluster)
    if (!area || homes.some((home) => home.area.id === area.id)) continue
    const runs = cluster.routeIndices.flatMap((routeIdx) => {
      const meta = routeMeta[routeIdx]
      return meta ? [{ routeIdx, id: meta.id, date: meta.date.slice(0, 10) }] : []
    })
    homes.push({ area, clusterId: cluster.id, runs, dataVersion: runsVersion(runs.map((run) => run.id)) })
  }
  return homes
}

/** The busiest cluster's area, if it has one: the map opens there. */
export function getExploreHome(): ExploreHome | null {
  const home = getExploreHomes()[0]
  if (!home) return null
  const { clusters, defaultClusterIdx } = getMapShellData()
  return home.clusterId === clusters[defaultClusterIdx]?.id ? home : null
}
