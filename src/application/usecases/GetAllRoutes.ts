import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

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
  clusters: RouteCluster[]
  defaultClusterIdx: number
  totalCount: number
  totalKm: number
  years: string[]
}

export function getAllRoutes(): AllRoutesData {
  // getAllActivities returns newest-first; keep that order so index 0 = most recent run
  const activities = getAllActivities().filter((a) => a.route && a.route.length > 1)

  const gridMap = new Map<
    string,
    {
      indices: number[]
      minLon: number; maxLon: number
      minLat: number; maxLat: number
      km: number
      sumCLon: number; sumCLat: number
    }
  >()

  let mostRecentKey: string | null = null

  activities.forEach((a, idx) => {
    const coords = a.route!
    const lons = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    const cLon = (Math.min(...lons) + Math.max(...lons)) / 2
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const key = `${Math.round(cLon)},${Math.round(cLat)}`

    if (idx === 0) mostRecentKey = key  // newest activity

    const g = gridMap.get(key) ?? {
      indices: [],
      minLon: Infinity, maxLon: -Infinity,
      minLat: Infinity, maxLat: -Infinity,
      km: 0, sumCLon: 0, sumCLat: 0,
    }
    g.indices.push(idx)
    g.minLon = Math.min(g.minLon, ...lons)
    g.maxLon = Math.max(g.maxLon, ...lons)
    g.minLat = Math.min(g.minLat, ...lats)
    g.maxLat = Math.max(g.maxLat, ...lats)
    g.km += a.distanceKm
    g.sumCLon += cLon
    g.sumCLat += cLat
    gridMap.set(key, g)
  })

  const clusters: RouteCluster[] = Array.from(gridMap.entries())
    .map(([id, g]) => ({
      id,
      routeCount: g.indices.length,
      totalKm: Math.round(g.km),
      center: [g.sumCLon / g.indices.length, g.sumCLat / g.indices.length] as [number, number],
      bounds: { minLon: g.minLon, maxLon: g.maxLon, minLat: g.minLat, maxLat: g.maxLat },
      routeIndices: g.indices,
    }))
    .sort((a, b) => b.routeCount - a.routeCount)

  const defaultClusterIdx = mostRecentKey
    ? Math.max(0, clusters.findIndex((c) => c.id === mostRecentKey))
    : 0

  return {
    routes: activities.map((a) => a.route!),
    clusters,
    defaultClusterIdx,
    totalCount: activities.length,
    totalKm: Math.round(activities.reduce((s, a) => s + a.distanceKm, 0)),
    years: Array.from(new Set(activities.map((a) => a.date.slice(0, 4)))).sort(),
  }
}
