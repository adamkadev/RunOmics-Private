import { inBBox } from './geometry'
import type { ExploreAreaRef } from './types'

function bboxSize([minLon, minLat, maxLon, maxLat]: ExploreAreaRef['bbox']): number {
  return (maxLon - minLon) * (maxLat - minLat)
}

/**
 * By bounding box only: the index carries no shapes, and the page has to answer
 * before any area file is fetched. Boxes can overlap, so the smallest box that
 * holds the point wins: it is the area built for this spot rather than one that
 * only reaches it.
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
 * The label point is a run's own centre, so it lies where the athlete runs; the
 * centre is a mean that can fall in a field between two spots, so it is only
 * the fallback.
 */
export function areaForCluster(
  areas: readonly ExploreAreaRef[],
  cluster: { labelPoint: [number, number]; center: [number, number] },
): ExploreAreaRef | null {
  return areaForPoint(areas, cluster.labelPoint) ?? areaForPoint(areas, cluster.center)
}
