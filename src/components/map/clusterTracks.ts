import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { decodeTracks } from '@/lib/polyline'

export type ClusterTracks = Record<string, [number, number][]>

/** Per page data, not per mount: the Map tab unmounts on List, and coming back refetched and reparsed 2 MB. */
const byShell = new WeakMap<MapShellData, Map<string, Promise<ClusterTracks | null>>>()

export function clusterTracks(shell: MapShellData, clusterId: string): Promise<ClusterTracks | null> {
  let byCluster = byShell.get(shell)
  if (!byCluster) byShell.set(shell, (byCluster = new Map()))
  const known = byCluster.get(clusterId)
  if (known) return known
  const pending = fetch(`/api/map/routes?cluster=${encodeURIComponent(clusterId)}&enc=p5`)
    .then((res) => (res.ok ? (res.json() as Promise<{ routes: Record<string, string | [number, number][]> }>) : null))
    .then((json) => (json ? decodeTracks(json.routes) : null))
    .catch(() => null)
  byCluster.set(clusterId, pending)
  // A failed fetch is not kept: the next open asks again.
  void pending.then((tracks) => {
    if (!tracks) byCluster.delete(clusterId)
  })
  return pending
}
