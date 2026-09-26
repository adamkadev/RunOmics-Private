import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { ActivityType } from '@/domain/activity/types'
import { distanceKm } from '@/lib/math'

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
  center: [number, number]
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number }
  routeIndices: number[]
}

export interface MapShellData {
  routeMeta: RouteMeta[]
  clusters: RouteCluster[]
  defaultClusterIdx: number
  totalCount: number
  totalKm: number
  years: string[]
}

export interface AllRoutesData extends MapShellData {
  routes: [number, number][][]
}

const CLUSTER_RADIUS_KM = 12

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

let cache: AllRoutesData | null = null

export function getAllRoutes(): AllRoutesData {
  if (cache) return cache

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

  })

  const unsorted: RouteCluster[] = acc.map((g, i) => ({
    id: `${i}`,
    routeCount: g.indices.length,
    totalKm: Math.round(g.km),
    center: g.center,
    bounds: { minLon: g.minLon, maxLon: g.maxLon, minLat: g.minLat, maxLat: g.maxLat },
    routeIndices: g.indices,
  }))

  // By km, the one share basis the page uses (v4.8): the busiest area comes
  // first and the page opens on it.
  const clusters = unsorted.sort((a, b) => b.totalKm - a.totalKm || b.routeCount - a.routeCount)
  const defaultClusterIdx = 0

  cache = {
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
  return cache
}

export function getMapShellData(): MapShellData {
  const { routeMeta, clusters, defaultClusterIdx, totalCount, totalKm, years } = getAllRoutes()
  return { routeMeta, clusters, defaultClusterIdx, totalCount, totalKm, years }
}
