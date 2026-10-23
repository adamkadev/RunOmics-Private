import type { MultiPolygon, Polygon } from 'geojson'
import { distanceKm } from '@/lib/math'
import { geometryBBox, inBBox, pointInGeometry, type BBox } from './geometry'
import { BREAK_M, MAX_STEP_M, cellCentre, cellOfXY, projection, sampleLine, type Projection } from './grid'
import { nextUnit } from './nextUnit'
import {
  COMPLETE_PCT,
  FOG_PCT,
  type AreaCoverage,
  type ExploreAreaFile,
  type UnitCoverage,
  type UnitKind,
  type UnitState,
} from './types'

/**
 * Split so a new run costs one pass over its own points: `activityCells` reduces
 * each activity once (the worker caches it by id), and `aggregateCoverage`
 * re-adds those small results, cheap enough for every filter tap.
 */

export const NO_UNIT = -1

export interface IndexedUnit {
  id: string
  name: string
  kind: UnitKind
  commune: string
  label: [number, number]
  geometry: Polygon | MultiPolygon
  bbox: BBox
  /** The runnable cells this unit owns: its denominator. */
  runnable: ReadonlySet<number>
}

export interface AreaIndex {
  areaId: string
  version: string
  proj: Projection
  units: readonly IndexedUnit[]
  /** cellKey → position in `units`, for every runnable cell. */
  runnableUnit: ReadonlyMap<number, number>
  /** Union of the unit boxes: a cell centre outside it belongs to no unit. */
  bbox: BBox
  /** Owners of non-runnable cells, so each point-in-polygon test is paid once per area, not once per sample. */
  ownerCache: Map<number, number>
}

export interface ActivityCells {
  /** Every cell holding a sample, runnable or not, sorted. */
  cells: number[]
  /** Metres run in each unit, in `AreaIndex.units` order. */
  metresByUnit: Float64Array
}

export interface ActivityCoverageInput {
  id: string
  /** 'YYYY-MM-DD' */
  date: string
  cells: ArrayLike<number>
  metresByUnit: ArrayLike<number>
}

function unionBBox(boxes: BBox[]): BBox {
  let [minLon, minLat, maxLon, maxLat] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [a, b, c, d] of boxes) {
    minLon = Math.min(minLon, a)
    minLat = Math.min(minLat, b)
    maxLon = Math.max(maxLon, c)
    maxLat = Math.max(maxLat, d)
  }
  return [minLon, minLat, maxLon, maxLat]
}

/**
 * A cell listed as runnable by two units (only a hand-edited file could) stays
 * with the first: otherwise the second unit could never reach 100%.
 */
export function buildAreaIndex(area: ExploreAreaFile): AreaIndex {
  const runnableUnit = new Map<number, number>()
  const units: IndexedUnit[] = area.features.map((feature, u) => {
    const runnable = new Set<number>()
    for (const cell of feature.properties.runnable) {
      if (runnableUnit.has(cell)) continue
      runnableUnit.set(cell, u)
      runnable.add(cell)
    }
    const { id, name, kind, commune, label } = feature.properties
    return { id, name, kind, commune, label, geometry: feature.geometry, bbox: geometryBBox(feature.geometry), runnable }
  })

  return {
    areaId: area.runomics.id,
    version: area.runomics.version,
    proj: projection(area.runomics.grid),
    units,
    runnableUnit,
    bbox: unionBBox(units.map((u) => u.bbox)),
    ownerCache: new Map(),
  }
}

/** Runnable membership comes first, so the denominator and the owner always agree. */
export function cellOwner(index: AreaIndex, cell: number): number {
  const runnable = index.runnableUnit.get(cell)
  if (runnable !== undefined) return runnable
  const cached = index.ownerCache.get(cell)
  if (cached !== undefined) return cached

  let owner = NO_UNIT
  const [lon, lat] = cellCentre(index.proj, cell)
  if (inBBox(lon, lat, index.bbox)) {
    for (let u = 0; u < index.units.length; u++) {
      const unit = index.units[u]!
      if (inBBox(lon, lat, unit.bbox) && pointInGeometry(lon, lat, unit.geometry)) {
        owner = u
        break
      }
    }
  }
  index.ownerCache.set(cell, owner)
  return owner
}

/**
 * Each step's length goes to the unit owning its midpoint's cell, so a street
 * along a boundary is split where it runs rather than credited twice. `coords`
 * is flat [lon, lat, lon, lat, …], as the worker receives it.
 */
export function activityCells(index: AreaIndex, coords: ArrayLike<number>): ActivityCells {
  const { proj } = index
  const cellM = proj.cellM
  const seen = new Set<number>()
  const metresByUnit = new Float64Array(index.units.length)
  let px = 0
  let py = 0

  sampleLine(coords, proj, MAX_STEP_M, BREAK_M, (x, y, step) => {
    seen.add(cellOfXY(cellM, x, y))
    if (step > 0) {
      const owner = cellOwner(index, cellOfXY(cellM, (px + x) / 2, (py + y) / 2))
      if (owner !== NO_UNIT) metresByUnit[owner] = metresByUnit[owner]! + step
    }
    px = x
    py = y
  })

  return { cells: Array.from(seen).sort((a, b) => a - b), metresByUnit }
}

/** The state follows the floored percentage, so the label and the colour never disagree. */
export function unitState(pct: number): UnitState {
  if (pct >= COMPLETE_PCT) return 'complete'
  if (pct < FOG_PCT) return 'fog'
  return 'partly'
}

function floorPct(part: number, whole: number): number {
  return whole > 0 ? Math.floor((100 * part) / whole) : 0
}

/** Units without a runnable cell are left out: one that can never be explored is not one of the "M quartiers". */
export function aggregateCoverage(
  index: AreaIndex,
  activities: readonly ActivityCoverageInput[],
  home: [number, number] | null,
): AreaCoverage {
  const n = index.units.length
  const visited = new Uint32Array(n)
  const metres = new Float64Array(n)
  const lastRun: (string | null)[] = new Array<string | null>(n).fill(null)
  const counted = new Set<number>()

  for (const activity of activities) {
    const date = activity.date.slice(0, 10)
    const { cells, metresByUnit } = activity
    for (let k = 0; k < cells.length; k++) {
      const cell = cells[k]!
      const runnable = index.runnableUnit.get(cell)
      if (runnable !== undefined && !counted.has(cell)) {
        counted.add(cell)
        visited[runnable] = visited[runnable]! + 1
      }
      const owner = runnable ?? cellOwner(index, cell)
      if (owner === NO_UNIT || !date) continue
      const last = lastRun[owner]
      if (last === null || last === undefined || date > last) lastRun[owner] = date
    }
    const m = Math.min(n, metresByUnit.length)
    for (let u = 0; u < m; u++) metres[u] = metres[u]! + metresByUnit[u]!
  }

  const units: UnitCoverage[] = []
  let visitedSum = 0
  let totalSum = 0
  for (let u = 0; u < n; u++) {
    const unit = index.units[u]!
    const total = unit.runnable.size
    if (total === 0) continue
    const count = visited[u]!
    const pct = floorPct(count, total)
    visitedSum += count
    totalSum += total
    units.push({
      id: unit.id,
      name: unit.name,
      kind: unit.kind,
      commune: unit.commune,
      label: unit.label,
      visited: count,
      total,
      pct,
      state: unitState(pct),
      kmRun: metres[u]! / 1000,
      lastRunDate: lastRun[u] ?? null,
      distanceKm: home ? distanceKm(home[0], home[1], unit.label[0], unit.label[1]) : null,
    })
  }

  return {
    areaId: index.areaId,
    version: index.version,
    units,
    exploredPct: floorPct(visitedSum, totalSum),
    completeCount: units.filter((u) => u.state === 'complete').length,
    unitCount: units.length,
    nextId: nextUnit(units)?.id ?? null,
    home,
  }
}
