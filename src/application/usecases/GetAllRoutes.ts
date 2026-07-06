import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { ActivityType } from '@/domain/activity/types'

export interface RouteMeta {
  id: string
  type: ActivityType
  year: string
  date: string
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
}

export interface RouteCluster {
  id: string
  routeCount: number
  totalKm: number
  // Actual centroid of all route bounding-box centres in this cluster
  center: [number, number]
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number }
  routeIndices: number[]
}

export interface AllRoutesData {
  routes: [number, number][][]
  routeMeta: RouteMeta[]
  clusters: RouteCluster[]
  defaultClusterIdx: number
  totalCount: number
  totalKm: number
  years: string[]
}

// Two cluster centers closer than this are considered the same place. Far enough to
// keep an entire city's runs together, close enough to split distinct towns that a
// fixed lon/lat grid cell would otherwise merge (e.g. Luxembourg-ville and Remich).
const CLUSTER_RADIUS_KM = 12

function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat1 - lat2) * 111.32
  const dLon = (lon1 - lon2) * 111.32 * Math.cos((lat1 * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

function findNearestClusterIdx(
  lon: number,
  lat: number,
  clusters: { center: [number, number] }[],
): number {
  let nearestIdx = -1
  let nearestDist = Infinity
  clusters.forEach((cl, i) => {
    const d = distanceKm(lon, lat, cl.center[0], cl.center[1])
    if (d <= CLUSTER_RADIUS_KM && d < nearestDist) {
      nearestDist = d
      nearestIdx = i
    }
  })
  return nearestIdx
}

export function getAllRoutes(): AllRoutesData {
  // getAllActivities returns newest-first; keep that order so index 0 = most recent run
  const activities = getAllActivities().filter((a) => a.route && a.route.length > 1)

  type ClusterAcc = {
    indices: number[]
    minLon: number; maxLon: number
    minLat: number; maxLat: number
    km: number
    sumCLon: number; sumCLat: number
    center: [number, number]
  }

  const acc: ClusterAcc[] = []
  let mostRecentClusterIdx = -1

  activities.forEach((a, idx) => {
    const coords = a.route!
    const lons = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    const cLon = (Math.min(...lons) + Math.max(...lons)) / 2
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2

    const nearestIdx = findNearestClusterIdx(cLon, cLat, acc)

    const clusterIdx = nearestIdx !== -1
      ? nearestIdx
      : acc.push({
        indices: [], minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity,
        km: 0, sumCLon: 0, sumCLat: 0, center: [cLon, cLat],
      }) - 1

    const g = acc[clusterIdx]
    if (!g) return
    g.indices.push(idx)
    g.minLon = Math.min(g.minLon, ...lons)
    g.maxLon = Math.max(g.maxLon, ...lons)
    g.minLat = Math.min(g.minLat, ...lats)
    g.maxLat = Math.max(g.maxLat, ...lats)
    g.km += a.distanceKm
    g.sumCLon += cLon
    g.sumCLat += cLat
    g.center = [g.sumCLon / g.indices.length, g.sumCLat / g.indices.length]

    if (idx === 0) mostRecentClusterIdx = clusterIdx
  })

  const unsorted: RouteCluster[] = acc.map((g, i) => ({
    id: `${i}`,
    routeCount: g.indices.length,
    totalKm: Math.round(g.km),
    center: g.center,
    bounds: { minLon: g.minLon, maxLon: g.maxLon, minLat: g.minLat, maxLat: g.maxLat },
    routeIndices: g.indices,
  }))

  const mostRecentId = mostRecentClusterIdx !== -1 ? `${mostRecentClusterIdx}` : null
  const clusters = unsorted.sort((a, b) => b.routeCount - a.routeCount)

  const defaultClusterIdx = mostRecentId
    ? Math.max(0, clusters.findIndex((c) => c.id === mostRecentId))
    : 0

  return {
    routes: activities.map((a) => a.route!),
    routeMeta: activities.map((a) => ({
      id: a.id,
      type: a.type,
      year: a.date.slice(0, 4),
      date: a.date.slice(0, 10),
      distanceKm: a.distanceKm,
      durationSeconds: a.durationSeconds,
      paceSecPerKm: a.paceSecPerKm,
    })),
    clusters,
    defaultClusterIdx,
    totalCount: activities.length,
    totalKm: Math.round(activities.reduce((s, a) => s + a.distanceKm, 0)),
    years: Array.from(new Set(activities.map((a) => a.date.slice(0, 4)))).sort(),
  }
}
