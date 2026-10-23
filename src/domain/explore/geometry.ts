import type { MultiPolygon, Polygon, Position } from 'geojson'

export type BBox = [number, number, number, number]

/** Even-odd test against one ring of [lon, lat] positions. */
function inRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [xa, ya] = ring[a]!
    const [xb, yb] = ring[b]!
    if (ya! > lat !== yb! > lat && lon < ((xb! - xa!) * (lat - ya!)) / (yb! - ya!) + xa!) inside = !inside
  }
  return inside
}

function inPolygonRings(lon: number, lat: number, rings: Position[][]): boolean {
  const [outer, ...holes] = rings
  if (!outer || !inRing(lon, lat, outer)) return false
  return !holes.some((hole) => inRing(lon, lat, hole))
}

/**
 * Whether [lon, lat] lies inside the shape, holes excluded. A point exactly
 * on a shared edge belongs to one side only (the even-odd rule's half-open
 * crossing test), so two neighbouring units never both claim a cell centre.
 */
export function pointInGeometry(lon: number, lat: number, geometry: Polygon | MultiPolygon): boolean {
  if (geometry.type === 'Polygon') return inPolygonRings(lon, lat, geometry.coordinates)
  return geometry.coordinates.some((rings) => inPolygonRings(lon, lat, rings))
}

export function geometryBBox(geometry: Polygon | MultiPolygon): BBox {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const rings of polygons) {
    for (const [lon, lat] of rings[0] ?? []) {
      if (lon! < minLon) minLon = lon!
      if (lon! > maxLon) maxLon = lon!
      if (lat! < minLat) minLat = lat!
      if (lat! > maxLat) maxLat = lat!
    }
  }
  return [minLon, minLat, maxLon, maxLat]
}

export function inBBox(lon: number, lat: number, [minLon, minLat, maxLon, maxLat]: BBox): boolean {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}
