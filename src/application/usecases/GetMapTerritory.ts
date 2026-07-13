import { getAllRoutes } from './GetAllRoutes'
import { distanceKm, median, round } from '@/lib/math'

export interface MapTerritory {
  center: [number, number]
  percentVolume: number
  medianRadiusKm: number
  routeCount: number
}

export function getMapTerritory(): MapTerritory | null {
  const { clusters, routes, totalKm } = getAllRoutes()
  const top = clusters[0]
  if (!top || totalKm <= 0) return null

  const radii = top.routeIndices
    .map((i) => routes[i])
    .filter((coords): coords is [number, number][] => !!coords && coords.length > 0)
    .map((coords) => {
      const lons = coords.map((c) => c[0])
      const lats = coords.map((c) => c[1])
      const cLon = (Math.min(...lons) + Math.max(...lons)) / 2
      const cLat = (Math.min(...lats) + Math.max(...lats)) / 2
      return distanceKm(cLon, cLat, top.center[0], top.center[1])
    })

  if (!radii.length) return null

  return {
    center: top.center,
    percentVolume: round((top.totalKm / totalKm) * 100, 0),
    medianRadiusKm: round(median(radii), 1),
    routeCount: top.routeCount,
  }
}
