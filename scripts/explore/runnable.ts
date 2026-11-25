import type { MultiPolygon, Polygon, Position } from 'geojson'
import { geometryBBox, inBBox, pointInGeometry, type BBox } from '@/domain/explore/geometry'
import { cellCentre, cellOfXY, M_PER_DEGREE, sampleLine, unproject, type Projection } from '@/domain/explore/grid'
import { assembleMultipolygon, type OsmMember, type OsmPoint } from './rings'

/**
 * Primary roads included: people run along them, on the pavement. In OSM the more specific tag wins, so `foot`
 * opens a way whatever `access` says; car-park aisles and driveways would make every car park a cell to "explore".
 */
export const RUNNABLE_HIGHWAYS = [
  'footway', 'path', 'track', 'residential', 'service', 'unclassified', 'living_street', 'pedestrian',
  'cycleway', 'steps', 'bridleway', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
  'primary', 'primary_link', 'road',
] as const

/** A 150 m cell is crossed in at least one sample unless the way only clips a corner by under 25 m. */
export const RUNNABLE_STEP_M = 25

/** Overpass's bbox order is south, west, north, east. */
function overpassBBox([minLon, minLat, maxLon, maxLat]: BBox): string {
  return [minLat, minLon, maxLat, maxLon].map((v) => v.toFixed(6)).join(',')
}

/** One union, which Overpass returns without duplicates. */
export function runnableWaysQuery(bbox: BBox): string {
  const way = `way["highway"~"^(${RUNNABLE_HIGHWAYS.join('|')})$"]`
  const notCarPark = '["service"!~"^(parking_aisle|driveway)$"]'
  const box = `(${overpassBBox(bbox)})`
  return [
    '[out:json][timeout:180];',
    '(',
    `  ${way}["foot"~"^(yes|designated|permissive)$"]${notCarPark}${box};`,
    `  ${way}["access"!~"^(private|no)$"]["foot"!~"^(private|no)$"]${notCarPark}${box};`,
    ');',
    'out skel geom qt;',
  ].join('\n')
}

/** Overpass answers a 7 km tile far faster than a 15 km box, and a failed tile is retried alone while the others stay cached. */
export function tileBBox([minLon, minLat, maxLon, maxLat]: BBox, maxLonSpan: number, maxLatSpan: number): BBox[] {
  const columns = Math.max(1, Math.ceil((maxLon - minLon) / maxLonSpan))
  const rows = Math.max(1, Math.ceil((maxLat - minLat) / maxLatSpan))
  const tiles: BBox[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      tiles.push([
        minLon + ((maxLon - minLon) * c) / columns,
        minLat + ((maxLat - minLat) * r) / rows,
        minLon + ((maxLon - minLon) * (c + 1)) / columns,
        minLat + ((maxLat - minLat) * (r + 1)) / rows,
      ])
    }
  }
  return tiles
}

export interface OverpassWay {
  type: string
  id: number
  geometry?: ({ lat: number; lon: number } | null)[]
}

export interface OverpassResponse {
  elements?: OverpassWay[]
  remark?: string
  osm3s?: { timestamp_osm_base?: string }
}

/** A 200 whose remark reports a timeout or out-of-memory holds partial data. */
export function overpassProblem(text: string): string | null {
  try {
    const json = JSON.parse(text) as OverpassResponse
    if (!Array.isArray(json.elements)) return 'no elements in the response'
    if (json.remark && /error|timed out|out of memory/i.test(json.remark)) return `Overpass remark: ${json.remark}`
    return null
  } catch {
    return 'the response is not JSON'
  }
}

/** Flat [lon, lat, …] per way, the shape `sampleLine` walks. */
export function wayCoords(way: OverpassWay): number[] {
  const coords: number[] = []
  for (const point of way.geometry ?? []) {
    if (point) coords.push(point.lon, point.lat)
  }
  return coords
}

/** No break distance: a way's nodes are joined by the street itself, however far apart, unlike GPS samples. */
export function wayCells(
  coords: ArrayLike<number>,
  p: Projection,
  into = new Set<number>(),
  stepM = RUNNABLE_STEP_M,
  keep: ((lon: number, lat: number) => boolean) | null = null,
): Set<number> {
  sampleLine(coords, p, stepM, Infinity, (x, y) => {
    if (keep && !keep(...unproject(p, x, y))) return
    into.add(cellOfXY(p.cellM, x, y))
  })
  return into
}

/** Under a hectare is a clump of trees in a park, whose paths still count; a forest's trails would never be finished. */
export const MIN_FOREST_M2 = 10_000

export function forestQuery(bbox: BBox): string {
  const box = `(${overpassBBox(bbox)})`
  return [
    '[out:json][timeout:180];',
    '(',
    `  way["landuse"="forest"]${box};`,
    `  way["natural"="wood"]${box};`,
    `  rel["type"="multipolygon"]["landuse"="forest"]${box};`,
    `  rel["type"="multipolygon"]["natural"="wood"]${box};`,
    ');',
    'out geom qt;',
  ].join('\n')
}

export interface OverpassArea {
  type: string
  id: number
  geometry?: (OsmPoint | null)[]
  members?: OsmMember[]
}

function ringAreaM2(ring: readonly Position[]): number {
  const lat0 = ring[0]?.[1] ?? 0
  const kx = M_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180)
  let twice = 0
  for (let k = 0; k + 1 < ring.length; k++) {
    const [ax, ay] = [ring[k]![0]! * kx, ring[k]![1]! * M_PER_DEGREE]
    const [bx, by] = [ring[k + 1]![0]! * kx, ring[k + 1]![1]! * M_PER_DEGREE]
    twice += ax * by - bx * ay
  }
  return Math.abs(twice) / 2
}

function areaM2(geometry: Polygon | MultiPolygon): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.reduce((sum, [outer, ...holes]) => sum + ringAreaM2(outer ?? []) - holes.reduce((h, ring) => h + ringAreaM2(ring), 0), 0)
}

/** A closed way is one polygon, a relation its assembled rings; an open way or a ring cut short is dropped. */
export function forestShapes(elements: readonly OverpassArea[], minM2 = MIN_FOREST_M2): (Polygon | MultiPolygon)[] {
  const shapes: (Polygon | MultiPolygon)[] = []
  for (const element of elements) {
    let geometry: Polygon | MultiPolygon | null = null
    if (element.type === 'way') {
      const ring = (element.geometry ?? []).filter((point): point is OsmPoint => point !== null).map((point): Position => [point.lon, point.lat])
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (ring.length >= 4 && first && last && first[0] === last[0] && first[1] === last[1]) geometry = { type: 'Polygon', coordinates: [ring] }
    } else if (element.type === 'relation') {
      geometry = assembleMultipolygon(element.members ?? []).geometry
    }
    if (geometry && areaM2(geometry) >= minM2) shapes.push(geometry)
  }
  return shapes
}

/** Whether a point lies outside every forest, the bounding boxes first so most samples skip the polygon test. */
export function outsideForests(forests: readonly (Polygon | MultiPolygon)[]): (lon: number, lat: number) => boolean {
  const boxes = forests.map(geometryBBox)
  return (lon, lat) => !forests.some((forest, i) => inBBox(lon, lat, boxes[i]!) && pointInGeometry(lon, lat, forest))
}

export interface UnitShape {
  id: string
  /** Unsimplified, as the source drew it. */
  geometry: Polygon | MultiPolygon
}

/** Where two sources overlap by a few metres the first unit in `units` wins, so the order is the tie-break. */
export function assignCells(cells: Iterable<number>, units: readonly UnitShape[], p: Projection): Map<string, number[]> {
  const boxes = units.map((unit) => geometryBBox(unit.geometry))
  const result = new Map<string, number[]>(units.map((unit) => [unit.id, []]))
  for (const key of cells) {
    const [lon, lat] = cellCentre(p, key)
    const index = units.findIndex((unit, i) => inBBox(lon, lat, boxes[i]!) && pointInGeometry(lon, lat, unit.geometry))
    if (index !== -1) result.get(units[index]!.id)!.push(key)
  }
  for (const keys of result.values()) keys.sort((a, b) => a - b)
  return result
}
