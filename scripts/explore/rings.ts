import type { MultiPolygon, Polygon, Position } from 'geojson'
import { pointInGeometry } from '@/domain/explore/geometry'

// Overpass gives a relation's member ways in no particular order or direction; shared nodes have identical coordinates.

export interface OsmPoint {
  lat: number
  lon: number
}

export interface OsmMember {
  type: string
  ref: number
  role: string
  /** Null entries are nodes outside an `out geom(bbox)` window. */
  geometry?: (OsmPoint | null)[]
}

const key = ([lon, lat]: Position) => `${lon},${lat}`

function isClosed(line: readonly Position[]): boolean {
  const first = line[0]
  const last = line[line.length - 1]
  return line.length >= 4 && !!first && !!last && key(first) === key(last)
}

/** A line that never closes (an incomplete relation, or one cut by a bbox) is dropped rather than closed by a guess. */
export function joinRings(lines: readonly (readonly Position[])[]): { rings: Position[][]; open: number } {
  const rings: Position[][] = []
  const pool: Position[][] = []
  for (const line of lines) {
    if (line.length < 2) continue
    if (isClosed(line)) rings.push([...line])
    else pool.push([...line])
  }

  let open = 0
  while (pool.length) {
    let current = pool.shift()!
    let flipped = false
    while (!isClosed(current)) {
      const end = key(current[current.length - 1]!)
      const index = pool.findIndex((line) => key(line[0]!) === end || key(line[line.length - 1]!) === end)
      if (index !== -1) {
        const [next] = pool.splice(index, 1)
        const forward = key(next![0]!) === end ? next! : [...next!].reverse()
        current = [...current, ...forward.slice(1)]
      } else if (!flipped) {
        // Nothing continues this end: grow from the other one instead.
        current = [...current].reverse()
        flipped = true
      } else {
        break
      }
    }
    if (isClosed(current)) rings.push(current)
    else open++
  }
  return { rings, open }
}

function memberLines(members: readonly OsmMember[], roles: readonly string[]): Position[][] {
  return members
    .filter((member) => member.type === 'way' && roles.includes(member.role))
    .map((member) => (member.geometry ?? []).filter((p): p is OsmPoint => p !== null).map((p) => [p.lon, p.lat]))
}

/** A vertex of `inner` that is not a vertex of `outer`, so a touching hole is not judged on the shared node. */
function probe(inner: readonly Position[], outer: readonly Position[]): Position | undefined {
  const shared = new Set(outer.map(key))
  return inner.find((p) => !shared.has(key(p)))
}

/** Outer rings have the role `outer`, or none, as old relations have. */
export function assembleMultipolygon(members: readonly OsmMember[]): { geometry: Polygon | MultiPolygon | null; open: number } {
  const outers = joinRings(memberLines(members, ['outer', '']))
  const inners = joinRings(memberLines(members, ['inner']))
  const polygons: Position[][][] = outers.rings.map((ring) => [ring])

  for (const inner of inners.rings) {
    const owner = polygons.find(([outer]) => {
      const point = probe(inner, outer!)
      return !!point && pointInGeometry(point[0]!, point[1]!, { type: 'Polygon', coordinates: [outer!] })
    })
    owner?.push(inner)
  }

  const open = outers.open + inners.open
  if (polygons.length === 0) return { geometry: null, open }
  return {
    geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0]! } : { type: 'MultiPolygon', coordinates: polygons },
    open,
  }
}
