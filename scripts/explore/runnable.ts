import type { MultiPolygon, Polygon } from 'geojson'
import { geometryBBox, inBBox, pointInGeometry, type BBox } from '@/domain/explore/geometry'
import { cellCentre, cellOfXY, sampleLine, type Projection } from '@/domain/explore/grid'

/**
 * The denominator of every quartier's percentage: the 150 m cells that hold
 * a way someone could run along. A cell of river, rail yard or private
 * woodland is never "unexplored", because no run could ever visit it.
 *
 * Runnable is every OSM highway a runner can use on foot, from footpaths to
 * primary roads (people do run along them, on the pavement), less what is
 * closed to them:
 * - `foot` = private | no;
 * - `access` = private | no, unless `foot` = yes | designated | permissive:
 *   in OSM the more specific tag wins, so a greenway closed to cars
 *   (`access=no`, `foot=designated`) or a private road with a public right of
 *   way (`access=private`, `foot=yes`) is open to a runner;
 * - `service` = parking_aisle | driveway: the lanes of a car park and the
 *   drive to a house would otherwise make every car park and back garden a
 *   cell to "explore". Measured on Metz they change the total by under 1%.
 * Motorways and trunk roads are left out by the list itself.
 */
export const RUNNABLE_HIGHWAYS = [
  'footway', 'path', 'track', 'residential', 'service', 'unclassified', 'living_street', 'pedestrian',
  'cycleway', 'steps', 'bridleway', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
  'primary', 'primary_link', 'road',
] as const

/**
 * Ways are sampled at least this often. A 150 m cell is crossed in no less
 * than one sample unless the way only clips a corner by under 25 m.
 */
export const RUNNABLE_STEP_M = 25

/** Overpass's bbox order is south, west, north, east. */
function overpassBBox([minLon, minLat, maxLon, maxLat]: BBox): string {
  return [minLat, minLon, maxLat, maxLon].map((v) => v.toFixed(6)).join(',')
}

/**
 * Two statements in one union, which Overpass returns without duplicates:
 * the ways `foot` opens whatever `access` says, and the ways neither tag
 * closes.
 */
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

/**
 * Cuts a bbox into tiles no bigger than the given spans, in a fixed order.
 * Overpass answers a 7 km tile in a fraction of the time a 15 km box takes,
 * fails less often at capacity, and a failed tile is retried alone while the
 * others stay cached.
 */
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

/**
 * Adds the cells a way passes through. No break distance: a way's nodes are
 * joined by the street itself, however far apart, unlike GPS samples.
 */
export function wayCells(coords: ArrayLike<number>, p: Projection, into = new Set<number>(), stepM = RUNNABLE_STEP_M): Set<number> {
  sampleLine(coords, p, stepM, Infinity, (x, y) => {
    into.add(cellOfXY(p.cellM, x, y))
  })
  return into
}

export interface UnitShape {
  id: string
  /** Unsimplified, as the source drew it. */
  geometry: Polygon | MultiPolygon
}

/**
 * Gives each runnable cell to the unit holding its centre, tested against the
 * unsimplified outline. Where two sources overlap (a city's quartiers and
 * IGN's neighbouring commune disagree by a few metres) the first unit in
 * `units` wins, so the order is the tie-break; a cell in no unit is dropped.
 * Each unit's keys come back sorted.
 */
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
