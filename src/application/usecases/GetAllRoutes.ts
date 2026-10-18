import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { ActivityType } from '@/domain/activity/types'
import { distanceKm } from '@/lib/math'
import { percentileBounds, type LngLatBounds } from '@/lib/routeFrame'

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
  /**
   * Where the area is named from: the centre of the run that sits closest to
   * all the others. `center` is a mean, and an area made of two or three
   * separate spots averages to somewhere between them - a village with no
   * run in it, which reverse geocoding then names.
   */
  labelPoint: [number, number]
  bounds: LngLatBounds
  /**
   * What the map opens on (v4.17): the 4th to 96th percentile of the area's
   * points, where `bounds` holds every one of them.
   */
  frame: LngLatBounds
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

/** The point with the smallest summed distance to every other: always one of `points`. */
export function medoid(points: [number, number][]): [number, number] {
  let best = points[0]!
  let bestSum = Infinity
  for (const p of points) {
    let sum = 0
    for (const q of points) sum += distanceKm(p[0], p[1], q[0], q[1])
    if (sum < bestSum) {
      bestSum = sum
      best = p
    }
  }
  return best
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
    runCenters: [number, number][]
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
        km: 0, sumCLon: 0, sumCLat: 0, center: [cLon, cLat], runCenters: [],
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
    g.runCenters.push([cLon, cLat])
    g.center = [g.sumCLon / g.indices.length, g.sumCLat / g.indices.length]

  })

  const unsorted: RouteCluster[] = acc.map((g, i) => {
    const bounds = { minLon: g.minLon, maxLon: g.maxLon, minLat: g.minLat, maxLat: g.maxLat }
    return {
      id: `${i}`,
      routeCount: g.indices.length,
      totalKm: Math.round(g.km),
      center: g.center,
      labelPoint: medoid(g.runCenters),
      bounds,
      frame: percentileBounds(g.indices.map((idx) => activities[idx]!.route!)) ?? bounds,
      routeIndices: g.indices,
    }
  })

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
