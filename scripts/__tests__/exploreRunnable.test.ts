import type { Polygon, Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { cellKey, projection, unproject } from '@/domain/explore/grid'
import { assignCells, overpassProblem, RUNNABLE_STEP_M, runnableWaysQuery, tileBBox, wayCells, wayCoords } from '../explore/runnable'

const p = projection({ origin: [20, 5], cellM: 150 })
/** A way through points given in metres east and north of the origin, as flat [lon, lat, …]. */
const line = (...points: [number, number][]) => points.flatMap(([x, y]) => unproject(p, x, y))
const square = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => unproject(p, x!, y!) as Position)],
})

describe('wayCells', () => {
  it('marks each cell a straight way passes through, and no other', () => {
    expect([...wayCells(line([10, 75], [440, 75]), p)].sort((a, b) => a - b)).toEqual([cellKey(0, 0), cellKey(1, 0), cellKey(2, 0)])
  })

  it('interpolates between nodes however far apart: a street has no GPS gaps', () => {
    expect(wayCells(line([10, 75], [1040, 75]), p).size).toBe(7)
  })

  it('catches a way clipping a cell corner for about 50 m, and every other cell it crosses', () => {
    // x + y = 560 crosses cell (1, 1), [150, 300]², only between (260, 300)
    // and (300, 260): 57 m. Its ends sit 14 m into cells (0, 3) and (3, 0).
    const cells = wayCells(line([100, 460], [460, 100]), p)
    expect(cells.has(cellKey(1, 1))).toBe(true)
    expect([...cells].sort((a, b) => a - b)).toEqual(
      [cellKey(0, 2), cellKey(0, 3), cellKey(1, 1), cellKey(1, 2), cellKey(2, 0), cellKey(2, 1), cellKey(3, 0)],
    )
  })

  it('samples at most 25 m apart, so even a 30 m corner clip lands a sample in the cell', () => {
    expect(RUNNABLE_STEP_M).toBeLessThanOrEqual(25)
    // x + y = 578.8 cuts the corner (300, 300) of cell (1, 1) along a 30 m chord.
    const c = 600 - 30 / Math.SQRT2
    expect(wayCells(line([100, c - 100], [c - 100, 100]), p).has(cellKey(1, 1))).toBe(true)
  })

  it('adds to the set it is given', () => {
    const into = new Set([42])
    wayCells(line([10, 75], [20, 75]), p, into)
    expect([...into]).toEqual([42, cellKey(0, 0)])
  })

  it('reads Overpass geometry, skipping nodes outside the window', () => {
    expect(wayCoords({ type: 'way', id: 1, geometry: [{ lat: 5, lon: 20 }, null, { lat: 5.1, lon: 20.1 }] })).toEqual([20, 5, 20.1, 5.1])
  })
})

describe('assignCells', () => {
  const units = [
    { id: 'west', geometry: square(0, 0, 300, 300) },
    { id: 'east', geometry: square(300, 0, 600, 300) },
    // Overlaps both along the bottom row: listed last, so it never wins a cell there.
    { id: 'strip', geometry: square(0, 0, 900, 150) },
  ]

  it('gives each cell to the first unit holding its centre, drops the rest, and sorts', () => {
    const cells = [cellKey(1, 1), cellKey(0, 0), cellKey(2, 0), cellKey(5, 0), cellKey(0, 4)]
    const assigned = assignCells(cells, units, p)
    expect(assigned.get('west')).toEqual([cellKey(0, 0), cellKey(1, 1)])
    expect(assigned.get('east')).toEqual([cellKey(2, 0)])
    expect(assigned.get('strip')).toEqual([cellKey(5, 0)])
  })

  it('lists every unit, even one with no cell', () => {
    expect(assignCells([], units, p).get('east')).toEqual([])
  })
})

describe('the Overpass query', () => {
  const query = runnableWaysQuery([6.1, 49.05, 6.2, 49.1])

  it('asks for the runnable highways in south, west, north, east order', () => {
    expect(query).toContain('[out:json][timeout:180];')
    expect(query).toContain('(49.050000,6.100000,49.100000,6.200000)')
    expect(query).toContain('footway|path|track|residential|service')
    expect(query).toContain('out skel geom qt;')
    expect(query).not.toMatch(/motorway|trunk/)
  })

  it('leaves out private ways, car-park aisles and driveways', () => {
    expect(query).toContain('["access"!~"^(private|no)$"]["foot"!~"^(private|no)$"]')
    expect(query.match(/\["service"!~"\^\(parking_aisle\|driveway\)\$"\]/g)).toHaveLength(2)
  })

  it('keeps a way closed to traffic that is open on foot: `foot` wins over `access`', () => {
    // e.g. a greenway tagged access=no + foot=designated, or a private road with foot=yes.
    const statements = query.split('\n').filter((line) => line.trim().startsWith('way['))
    expect(statements).toHaveLength(2)
    const openOnFoot = statements.find((line) => line.includes('["foot"~"^(yes|designated|permissive)$"]'))!
    expect(openOnFoot).toBeDefined()
    expect(openOnFoot).not.toContain('"access"')
    // A union, so a way matching both comes back once.
    expect(query).toMatch(/\(\n\s+way\[[^\n]+;\n\s+way\[[^\n]+;\n\);\nout skel geom qt;$/)
  })

  it('treats a 200 with an error remark as a failure', () => {
    expect(overpassProblem('{"elements":[]}')).toBeNull()
    expect(overpassProblem('{"elements":[],"remark":"runtime error: Query timed out in \\"query\\""}')).toMatch(/timed out/)
    expect(overpassProblem('<html>busy</html>')).not.toBeNull()
  })
})

describe('tileBBox', () => {
  it('cuts a box into tiles within the spans that cover it exactly', () => {
    const tiles = tileBBox([6, 49, 6.2, 49.1], 0.09, 0.06)
    expect(tiles).toHaveLength(6)
    for (const [minLon, minLat, maxLon, maxLat] of tiles) {
      expect(maxLon - minLon).toBeLessThanOrEqual(0.09)
      expect(maxLat - minLat).toBeLessThanOrEqual(0.06)
    }
    expect(tiles[0]!.slice(0, 2)).toEqual([6, 49])
    expect(tiles[5]!.slice(2)).toEqual([6.2, 49.1])
  })

  it('keeps a small box whole', () => {
    expect(tileBBox([6, 49, 6.05, 49.03], 0.09, 0.06)).toEqual([[6, 49, 6.05, 49.03]])
  })
})
