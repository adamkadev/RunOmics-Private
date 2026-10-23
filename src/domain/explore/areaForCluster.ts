import { inBBox } from './geometry'
import type { ExploreAreaRef } from './types'

function bboxSize([minLon, minLat, maxLon, maxLat]: ExploreAreaRef['bbox']): number {
  return (maxLon - minLon) * (maxLat - minLat)
}

/**
 * The area a point falls in, by bounding box only: the index carries no
 * shapes, and the page has to answer before any area file is fetched.
 *
 * Boxes can overlap - a city's area sits inside a wider one built around a
 * second cluster, or two neighbours' corners cross - so the smallest box
 * that holds the point wins: it is the area built for this spot rather than
 * one that only reaches it. Equal boxes keep the index's order.
 */
export function areaForPoint(areas: readonly ExploreAreaRef[], point: [number, number]): ExploreAreaRef | null {
  let best: ExploreAreaRef | null = null
  let bestSize = Infinity
  for (const area of areas) {
    if (!inBBox(point[0], point[1], area.bbox)) continue
    const size = bboxSize(area.bbox)
    if (size < bestSize) {
      best = area
      bestSize = size
    }
  }
  return best
}

/**
 * A cluster's area: where its `labelPoint` falls, else where its `center`
 * does. The label point is a run's own centre, so it lies where the athlete
 * runs; the centre is a mean, and an area made of two spots averages to a
 * field between them - kept only as the fallback.
 */
export function areaForCluster(
  areas: readonly ExploreAreaRef[],
  cluster: { labelPoint: [number, number]; center: [number, number] },
): ExploreAreaRef | null {
  return areaForPoint(areas, cluster.labelPoint) ?? areaForPoint(areas, cluster.center)
}
