import type { MultiPolygon, Polygon, Position } from 'geojson'
import { geometryBBox, inBBox, pointInGeometry, type BBox } from '@/domain/explore/geometry'

export interface Commune {
  /** INSEE code, e.g. '57463'. */
  code: string
  name: string
  population: number
  geometry: Polygon | MultiPolygon
}

export function communeContaining(lon: number, lat: number, communes: readonly Commune[]): Commune | undefined {
  return communes.find((commune) => pointInGeometry(lon, lat, commune.geometry))
}

/** The lower INSEE code breaks a tie, so it always resolves the same way. */
export function mostPopulous(communes: readonly Commune[]): Commune | undefined {
  return [...communes].sort((a, b) => b.population - a.population || a.code.localeCompare(b.code))[0]
}

function overlaps([aMinLon, aMinLat, aMaxLon, aMaxLat]: BBox, [bMinLon, bMinLat, bMaxLon, bMaxLat]: BBox): boolean {
  return aMinLon <= bMaxLon && bMinLon <= aMaxLon && aMinLat <= bMaxLat && bMinLat <= aMaxLat
}

function cross(o: Position, a: Position, b: Position): number {
  return (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!)
}

function segmentsCross(p1: Position, p2: Position, q1: Position, q2: Position): boolean {
  const d1 = cross(q1, q2, p1)
  const d2 = cross(q1, q2, p2)
  const d3 = cross(p1, p2, q1)
  const d4 = cross(p1, p2, q2)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** A WFS BBOX filter only promises the shapes' envelopes overlap the box; this is the exact test on what came back. */
export function geometryIntersectsBBox(geometry: Polygon | MultiPolygon, bbox: BBox): boolean {
  if (!overlaps(geometryBBox(geometry), bbox)) return false
  const rings = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat()
  if (rings.some((ring) => ring.some(([lon, lat]) => inBBox(lon!, lat!, bbox)))) return true

  const [minLon, minLat, maxLon, maxLat] = bbox
  const corners: Position[] = [[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat]]
  if (corners.some(([lon, lat]) => pointInGeometry(lon!, lat!, geometry))) return true

  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      for (let c = 0; c < 4; c++) {
        if (segmentsCross(ring[i - 1]!, ring[i]!, corners[c]!, corners[(c + 1) % 4]!)) return true
      }
    }
  }
  return false
}

/** 0.01° is about 1 km: IGN and the cache only see this coarse box, never the frame drawn from track points. */
export function roundOutward([minLon, minLat, maxLon, maxLat]: BBox, step = 0.01): BBox {
  const down = (v: number) => Math.floor(v / step - 1e-9) * step
  const up = (v: number) => Math.ceil(v / step + 1e-9) * step
  const fix = (v: number) => Number(v.toFixed(6))
  return [fix(down(minLon)), fix(down(minLat)), fix(up(maxLon)), fix(up(maxLat))]
}

export function unionBBox(boxes: readonly BBox[]): BBox {
  return boxes.reduce<BBox>(
    ([minLon, minLat, maxLon, maxLat], [a, b, c, d]) => [Math.min(minLon, a), Math.min(minLat, b), Math.max(maxLon, c), Math.max(maxLat, d)],
    [Infinity, Infinity, -Infinity, -Infinity],
  )
}
