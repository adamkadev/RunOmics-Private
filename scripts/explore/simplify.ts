import type { MultiPolygon, Polygon, Position } from 'geojson'
import { projectX, projectY, unproject, type Projection } from '@/domain/explore/grid'

/**
 * Douglas-Peucker on the area's own flat projection, so the tolerance is in
 * metres on the ground. Degrees would not do: at 49°N a degree of longitude
 * is two thirds of a degree of latitude, and a "5 m" tolerance in degrees
 * would be 5 m one way and 3.3 m the other.
 *
 * Each ring is simplified on its own, so two neighbours can open a sliver of
 * up to the tolerance between them. At 5 m that is under a pixel at the
 * zooms the map shows a city at, and cells are assigned on the unsimplified
 * shapes (runnable.ts), so it never moves a count.
 *
 * What a ring may never do is cross itself. Douglas-Peucker only promises
 * that every dropped point lies within the tolerance of what is kept; a chord
 * that cuts a corner can still pass through a narrow part of the same ring
 * (a quay, a needle of land between two roads) and leave a bow-tie, which is
 * no longer a valid polygon: MapLibre fills it with a sliver, and the
 * even-odd test the worker gives cells by turns inside out there. So a ring
 * that comes out crossed is simplified again with half the tolerance, until
 * it no longer does.
 */

export type XY = [number, number]

export const SIMPLIFY_M = 5

function segmentDistance([px, py]: XY, [ax, ay]: XY, [bx, by]: XY): number {
  const dx = bx - ax
  const dy = by - ay
  const length2 = dx * dx + dy * dy
  if (length2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Keeps the first and last points, and every point further than `tolerance` from the line kept so far. */
export function douglasPeucker(points: readonly XY[], tolerance: number): XY[] {
  const n = points.length
  if (n <= 2) return points.slice()
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    let farthest = -1
    let max = 0
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!)
      if (d > max) {
        max = d
        farthest = i
      }
    }
    if (farthest !== -1 && max > tolerance) {
      keep[farthest] = 1
      stack.push([first, farthest], [farthest, last])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/** Below this a tolerance simplifies nothing that rounding to 6 decimals (about 0.1 m) does not already move. */
const MIN_TOLERANCE_M = 0.2

/** -1, 0 or 1: which side of the line a→b the point c is on. */
function side([ax, ay]: XY, [bx, by]: XY, [cx, cy]: XY): number {
  return Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
}

function within([ax, ay]: XY, [bx, by]: XY, [cx, cy]: XY): boolean {
  return Math.min(ax, bx) <= cx && cx <= Math.max(ax, bx) && Math.min(ay, by) <= cy && cy <= Math.max(ay, by)
}

/** Whether segments a–b and c–d share any point, touching included. */
function segmentsMeet(a: XY, b: XY, c: XY, d: XY): boolean {
  const s1 = side(a, b, c)
  const s2 = side(a, b, d)
  const s3 = side(c, d, a)
  const s4 = side(c, d, b)
  if (s1 !== s2 && s3 !== s4) return true
  return (s1 === 0 && within(a, b, c)) || (s2 === 0 && within(a, b, d)) || (s3 === 0 && within(c, d, a)) || (s4 === 0 && within(c, d, b))
}

/**
 * Whether a ring, given without its closing point, crosses or touches itself
 * anywhere other than where neighbouring edges meet. Every pair of edges is
 * tried: a simplified quartier has a few hundred vertices, and this runs
 * offline.
 */
export function ringSelfIntersects(ring: readonly XY[]): boolean {
  const n = ring.length
  if (n < 4) return false
  for (let i = 0; i < n; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    for (let j = i + 2; j < n; j++) {
      // The last edge closes onto the first: they share the start.
      if (i === 0 && j === n - 1) continue
      if (segmentsMeet(a, b, ring[j]!, ring[(j + 1) % n]!)) return true
    }
  }
  return false
}

/** Shoelace: positive when the ring runs anticlockwise. */
export function signedArea(ring: readonly XY[]): number {
  let sum = 0
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    sum += (ring[b]![0] - ring[a]![0]) * (ring[b]![1] + ring[a]![1])
  }
  return sum / 2
}

export const round6 = (value: number) => Math.round(value * 1e6) / 1e6

function project(p: Projection, ring: readonly Position[]): XY[] {
  return ring.map(([lon, lat]) => [projectX(p, lon!), projectY(p, lat!)])
}

/** Rounds to 6 decimals (about 0.1 m) and drops the repeats rounding makes. */
function toPositions(p: Projection, ring: readonly XY[]): Position[] {
  const out: Position[] = []
  for (const [x, y] of ring) {
    const [lon, lat] = unproject(p, x, y)
    const position = [round6(lon), round6(lat)]
    const previous = out[out.length - 1]
    if (!previous || previous[0] !== position[0] || previous[1] !== position[1]) out.push(position)
  }
  return out
}

/**
 * One closed ring, simplified, rounded and wound as RFC 7946 asks (outer
 * rings anticlockwise, holes clockwise), and never crossing itself (see the
 * top of this file). Null when nothing ring-like is left: fewer than four
 * positions, or less area than a tolerance-sided square.
 *
 * The check is made on the rounded positions, the ones the file will hold.
 * Halving stops once the tolerance is below what rounding moves; what comes
 * out then is the source ring itself, rounded, crossed only if the source
 * already was.
 */
export function simplifyRing(
  ring: readonly Position[],
  p: Projection,
  toleranceM: number,
  outer: boolean,
): Position[] | null {
  const points = project(p, ring)
  const first = points[0]
  const last = points[points.length - 1]
  if (first && last && first[0] === last[0] && first[1] === last[1]) points.pop()
  if (points.length < 3) return null

  for (let tolerance = toleranceM; ; tolerance /= 2) {
    // Written so a NaN tolerance ends the loop too.
    const exact = !(tolerance >= MIN_TOLERANCE_M)
    const positions = simplifyRingOnce(points, p, exact ? 0 : tolerance, toleranceM, outer)
    if (!positions || exact || !ringSelfIntersects(project(p, positions.slice(0, -1)))) return positions
  }
}

/**
 * One pass of `simplifyRing` at one tolerance. `minAreaM` stays the asked
 * tolerance's: a tighter retry must not keep a ring the first pass dropped.
 *
 * A closed ring's first and last points coincide, so Douglas-Peucker on it
 * as one line would measure everything against a zero-length segment. It is
 * split at the point furthest from the start and each half simplified, which
 * also keeps it from ever collapsing to a line.
 */
function simplifyRingOnce(
  points: readonly XY[],
  p: Projection,
  toleranceM: number,
  minAreaM: number,
  outer: boolean,
): Position[] | null {
  const start = points[0]!
  let split = 1
  let max = -1
  points.forEach(([x, y], i) => {
    const d = Math.hypot(x - start[0], y - start[1])
    if (d > max) {
      max = d
      split = i
    }
  })
  const head = douglasPeucker(points.slice(0, split + 1), toleranceM)
  const tail = douglasPeucker([...points.slice(split), start], toleranceM)
  let simplified: XY[] = [...head, ...tail.slice(1)]

  const area = signedArea(simplified)
  if (Math.abs(area) < minAreaM * minAreaM) return null
  if (area > 0 !== outer) simplified = simplified.reverse()

  const positions = toPositions(p, simplified)
  const closing = positions[0]!
  const end = positions[positions.length - 1]!
  if (closing[0] !== end[0] || closing[1] !== end[1]) positions.push([...closing])
  return positions.length >= 4 ? positions : null
}

function simplifyRings(rings: readonly Position[][], p: Projection, toleranceM: number): Position[][] | null {
  const [outer, ...holes] = rings
  if (!outer) return null
  const shell = simplifyRing(outer, p, toleranceM, true)
  if (!shell) return null
  const kept = holes.map((hole) => simplifyRing(hole, p, toleranceM, false)).filter((hole): hole is Position[] => hole !== null)
  return [shell, ...kept]
}

function roundRings(rings: readonly Position[][]): Position[][] {
  return rings.map((ring) => ring.map(([lon, lat]) => [round6(lon!), round6(lat!)]))
}

/**
 * Simplifies every polygon of the shape. Islands smaller than the tolerance
 * square go, and so do holes; if nothing at all would be left (a unit
 * smaller than 25 m²), the shape is kept whole, only rounded.
 */
export function simplifyGeometry(
  geometry: Polygon | MultiPolygon,
  p: Projection,
  toleranceM = SIMPLIFY_M,
): Polygon | MultiPolygon {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const simplified = polygons
    .map((rings) => simplifyRings(rings, p, toleranceM))
    .filter((rings): rings is Position[][] => rings !== null)
  if (simplified.length === 0) {
    const rounded = polygons.map(roundRings)
    return rounded.length === 1 ? { type: 'Polygon', coordinates: rounded[0]! } : { type: 'MultiPolygon', coordinates: rounded }
  }
  return simplified.length === 1
    ? { type: 'Polygon', coordinates: simplified[0]! }
    : { type: 'MultiPolygon', coordinates: simplified }
}

/** Ground area in m², holes taken out. */
export function geometryAreaM2(geometry: Polygon | MultiPolygon, p: Projection): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let total = 0
  for (const [outer, ...holes] of polygons) {
    if (!outer) continue
    total += Math.abs(signedArea(project(p, outer)))
    for (const hole of holes) total -= Math.abs(signedArea(project(p, hole)))
  }
  return total
}

export function vertexCount(geometry: Polygon | MultiPolygon): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.reduce((sum, rings) => sum + rings.reduce((s, ring) => s + ring.length, 0), 0)
}
