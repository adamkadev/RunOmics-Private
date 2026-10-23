import type { MultiPolygon, Polygon } from 'geojson'
import { CELL_M, cellKey, projection, unproject } from '../grid'
import type { ExploreAreaFile, ExploreUnitFeature, UnitKind } from '../types'

/**
 * Hand-built areas for the Explore tests. Every shape is drawn in metres
 * east and north of a fictional origin in the mid-Pacific (nowhere anyone
 * runs), so the expected cells can be read straight off the numbers.
 */

export const ORIGIN: [number, number] = [-150, 45]
export const GRID = { origin: ORIGIN, cellM: CELL_M }
export const PROJ = projection(GRID)

/** [lon, lat] of a point `x` metres east and `y` metres north of the origin. */
export function at(x: number, y: number): [number, number] {
  return unproject(PROJ, x, y)
}

/** An axis-aligned rectangle given in metres, as a closed counter-clockwise ring. */
export function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return { type: 'Polygon', coordinates: [[at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)]] }
}

/** Sorted keys of cells i0..i1 × j0..j1 (inclusive), minus `except`. */
export function cells(i0: number, i1: number, j0: number, j1: number, except: [number, number][] = []): number[] {
  const skip = new Set(except.map(([i, j]) => cellKey(i, j)))
  const keys: number[] = []
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!skip.has(cellKey(i, j))) keys.push(cellKey(i, j))
  return keys.sort((a, b) => a - b)
}

export function unit(
  id: string,
  name: string,
  geometry: Polygon | MultiPolygon,
  runnable: number[],
  { kind = 'quartier', label }: { kind?: UnitKind; label?: [number, number] } = {},
): ExploreUnitFeature {
  const ring = geometry.type === 'Polygon' ? geometry.coordinates[0]! : geometry.coordinates[0]![0]!
  const [a, , c] = ring
  const centre: [number, number] = [(a![0]! + c![0]!) / 2, (a![1]! + c![1]!) / 2]
  return {
    type: 'Feature',
    id,
    properties: { id, name, kind, commune: 'Testville', label: label ?? centre, runnable },
    geometry,
  }
}

export function areaFile(features: ExploreUnitFeature[], version = 'test-20261022-abcdef12'): ExploreAreaFile {
  return {
    type: 'FeatureCollection',
    runomics: {
      schema: 1,
      id: 'test',
      name: 'Testville',
      version,
      generatedAt: '2026-10-22',
      grid: GRID,
      bbox: [ORIGIN[0], ORIGIN[1], ORIGIN[0] + 0.1, ORIGIN[1] + 0.1],
      sources: [{ id: 'test', label: 'Test shapes', licence: 'CC0', url: 'https://example.org', version: '1' }],
    },
    features,
  }
}

/** Points every `stepM` metres from (x0, y0) to (x1, y1), both ends included. */
export function line(x0: number, y0: number, x1: number, y1: number, stepM: number): [number, number][] {
  const length = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.max(1, Math.round(length / stepM))
  return Array.from({ length: n + 1 }, (_, k): [number, number] => [x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
}

/** Flat [lon, lat, …] of a polyline given in metres. */
export function track(pointsM: [number, number][]): Float64Array {
  const flat = new Float64Array(pointsM.length * 2)
  pointsM.forEach(([x, y], k) => {
    const [lon, lat] = at(x, y)
    flat[2 * k] = lon
    flat[2 * k + 1] = lat
  })
  return flat
}

/**
 * The coverage fixture, 150 m cells, metres east × north of the origin:
 *
 *   Charlie  x 0–1200,    y 600–750  no runnable cell: dropped
 *   Alpha    x 0–600,     y 0–600    16 cells, 14 runnable (not (1,0), (2,2))
 *   Delta    x 600–1200,  y 150–600  12 cells, 10 runnable (not (6,3), (7,3))
 *   Bravo    x 600–1200,  y 0–150     4 cells, all runnable
 */
export function testArea(): ExploreAreaFile {
  return areaFile([
    unit('test-alpha', 'Alpha', rect(0, 0, 600, 600), cells(0, 3, 0, 3, [[1, 0], [2, 2]])),
    unit('test-bravo', 'Bravo', rect(600, 0, 1200, 150), cells(4, 7, 0, 0)),
    unit('test-charlie', 'Charlie', rect(0, 600, 1200, 750), []),
    unit('test-delta', 'Delta', rect(600, 150, 1200, 600), cells(4, 7, 1, 3, [[6, 3], [7, 3]])),
  ])
}
