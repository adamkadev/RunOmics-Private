import type { MultiPolygon, Polygon, Position } from 'geojson'
import { pointInGeometry } from '@/domain/explore/geometry'
import { projectX, projectY, unproject, type Projection } from '@/domain/explore/grid'
import { round6, type XY } from './simplify'

// The pole of inaccessibility, as Mapbox's polylabel finds it: a crescent-shaped quartier's centroid lies in its neighbour.

interface Cell {
  x: number
  y: number
  /** Half the cell's side. */
  h: number
  /** Signed distance from the centre to the outline: positive inside. */
  d: number
  /** The best distance any point in the cell could have. */
  max: number
}

function segmentDistance2(px: number, py: number, a: XY, b: XY): number {
  let [x, y] = a
  let dx = b[0] - x
  let dy = b[1] - y
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = b[0]
      y = b[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }
  dx = px - x
  dy = py - y
  return dx * dx + dy * dy
}

/** Distance to the nearest edge of any ring, negative outside (even-odd, so holes count as outside). */
export function signedDistance(x: number, y: number, rings: readonly XY[][]): number {
  let inside = false
  let min = Infinity
  for (const ring of rings) {
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
      const pa = ring[a]!
      const pb = ring[b]!
      if (pa[1] > y !== pb[1] > y && x < ((pb[0] - pa[0]) * (y - pa[1])) / (pb[1] - pa[1]) + pa[0]) inside = !inside
      min = Math.min(min, segmentDistance2(x, y, pa, pb))
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(min)
}

function cell(x: number, y: number, h: number, rings: readonly XY[][]): Cell {
  const d = signedDistance(x, y, rings)
  return { x, y, h, d, max: d + h * Math.SQRT2 }
}

/** A max-heap on `max`: the cell that could still hold the best point comes out first. */
class CellQueue {
  private items: Cell[] = []
  get size(): number {
    return this.items.length
  }
  push(item: Cell): void {
    const items = this.items
    items.push(item)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent]!.max >= item.max) break
      items[i] = items[parent]!
      i = parent
    }
    items[i] = item
  }
  pop(): Cell | undefined {
    const items = this.items
    const top = items[0]
    const last = items.pop()
    if (!top || !last || items.length === 0) return top
    let i = 0
    const n = items.length
    for (;;) {
      const left = 2 * i + 1
      if (left >= n) break
      const right = left + 1
      const child = right < n && items[right]!.max > items[left]!.max ? right : left
      if (items[child]!.max <= last.max) break
      items[i] = items[child]!
      i = child
    }
    items[i] = last
    return top
  }
}

function centroidCell(rings: readonly XY[][]): Cell {
  const outer = rings[0]!
  let area = 0
  let x = 0
  let y = 0
  for (let a = 0, b = outer.length - 1; a < outer.length; b = a++) {
    const pa = outer[a]!
    const pb = outer[b]!
    const f = pa[0] * pb[1] - pb[0] * pa[1]
    x += (pa[0] + pb[0]) * f
    y += (pa[1] + pb[1]) * f
    area += f * 3
  }
  if (area === 0) return cell(outer[0]![0], outer[0]![1], 0, rings)
  return cell(x / area, y / area, 0, rings)
}

/** The pole of inaccessibility of one polygon (outer ring first, then holes), to within `precision` metres. */
export function polylabel(rings: readonly XY[][], precision = 1): { x: number; y: number; d: number } {
  const outer = rings[0] ?? []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outer) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const width = maxX - minX
  const height = maxY - minY
  const size = Math.min(width, height)
  if (!(size > 0)) return { x: minX, y: minY, d: 0 }

  const queue = new CellQueue()
  for (let x = minX; x < maxX; x += size) {
    for (let y = minY; y < maxY; y += size) queue.push(cell(x + size / 2, y + size / 2, size / 2, rings))
  }

  let best = centroidCell(rings)
  const middle = cell(minX + width / 2, minY + height / 2, 0, rings)
  if (middle.d > best.d) best = middle

  while (queue.size) {
    const current = queue.pop()!
    if (current.d > best.d) best = current
    if (current.max - best.d <= precision) continue
    const h = current.h / 2
    queue.push(cell(current.x - h, current.y - h, h, rings))
    queue.push(cell(current.x + h, current.y - h, h, rings))
    queue.push(cell(current.x - h, current.y + h, h, rings))
    queue.push(cell(current.x + h, current.y + h, h, rings))
  }
  return { x: best.x, y: best.y, d: best.d }
}

function projectRings(p: Projection, rings: readonly Position[][]): XY[][] {
  return rings.map((ring) => ring.map(([lon, lat]) => [projectX(p, lon!), projectY(p, lat!)] as XY))
}

/** Checked against `pointInGeometry`, the test the app itself uses, and every shape in `mustBeIn`, so it can't land on a sliver. */
export function labelPoint(
  geometry: Polygon | MultiPolygon,
  p: Projection,
  mustBeIn: readonly (Polygon | MultiPolygon)[] = [],
): [number, number] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let best: { x: number; y: number; d: number } | null = null
  for (const rings of polygons) {
    const candidate = polylabel(projectRings(p, rings))
    if (!best || candidate.d > best.d) best = candidate
  }
  if (!best) throw new Error('labelPoint: empty geometry')

  const shapes = [geometry, ...mustBeIn]
  const inside = ([lon, lat]: [number, number]) => shapes.every((shape) => pointInGeometry(lon, lat, shape))
  const rounded = (x: number, y: number): [number, number] => {
    const [lon, lat] = unproject(p, x, y)
    return [round6(lon), round6(lat)]
  }

  const label = rounded(best.x, best.y)
  if (inside(label)) return label

  // Only a unit thinner than the simplification tolerance gets here: the deepest point of a fine scan both outlines agree on.
  let fallback: [number, number] | null = null
  let depth = -Infinity
  for (const rings of polygons) {
    const xy = projectRings(p, rings)
    const xs = xy[0]!.map(([x]) => x)
    const ys = xy[0]!.map(([, y]) => y)
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    for (let i = 0; i <= 64; i++) {
      for (let j = 0; j <= 64; j++) {
        const x = minX + ((maxX - minX) * i) / 64
        const y = minY + ((maxY - minY) * j) / 64
        const d = signedDistance(x, y, xy)
        const point = rounded(x, y)
        if (d > depth && inside(point)) {
          depth = d
          fallback = point
        }
      }
    }
  }
  if (fallback) return fallback
  throw new Error('labelPoint: no point inside the unit (is it smaller than a metre?)')
}
