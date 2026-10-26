import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { decodeTracks } from '@/lib/polyline'

export type ClusterTracks = Record<string, [number, number][]>

/** Per data version, not per mount: the Map tab unmounts on List, and coming back refetched and reparsed it all. */
const pending = new Map<string, Promise<unknown>>()

function once<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  const known = pending.get(key) as Promise<T | null> | undefined
  if (known) return known
  const loading = load().catch(() => null)
  pending.set(key, loading)
  // A failed fetch is not kept: the next open asks again.
  void loading.then((value) => {
    if (!value) pending.delete(key)
  })
  return loading
}

const json = <T,>(url: string) => fetch(url).then((res) => (res.ok ? (res.json() as Promise<T>) : null))

export function mapShell(version: string): Promise<MapShellData | null> {
  return once(`shell|${version}`, () => json<MapShellData>(`/api/map/shell?v=${encodeURIComponent(version)}`))
}

export function clusterTracks(version: string, clusterId: string): Promise<ClusterTracks | null> {
  const query = `cluster=${encodeURIComponent(clusterId)}&enc=p5&v=${encodeURIComponent(version)}`
  return once(`tracks|${version}|${clusterId}`, async () => {
    const body = await json<{ routes: Record<string, string | [number, number][]> }>(`/api/map/routes?${query}`)
    return body ? decodeTracks(body.routes) : null
  })
}
