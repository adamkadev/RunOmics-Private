import type { ActivityCoverageInput, AreaIndex } from './coverage'
import { COMPLETE_PCT } from './types'

export interface UnitGain {
  id: string
  name: string
  cells: number
  before: number
  after: number
}

export interface RunExploreGain {
  newCells: number
  /** Most cells first. */
  units: UnitGain[]
}

export interface CompleteUnit {
  id: string
  name: string
  pct: number
  /** The day of the run that took it past COMPLETE_PCT. */
  since: string
}

export interface ExploreGains {
  byRun: Map<string, RunExploreGain>
  complete: CompleteUnit[]
  /** Units with a runnable cell, as Explored counts them. */
  unitCount: number
}

const pctOf = (count: number, total: number) => (total > 0 ? Math.floor((100 * count) / total) : 0)

/** `runs` oldest first: a cell is new for the first run through it only. */
export function exploreGains(index: AreaIndex, runs: readonly ActivityCoverageInput[]): ExploreGains {
  const visited = new Set<number>()
  const counts = new Uint32Array(index.units.length)
  const byRun = new Map<string, RunExploreGain>()
  const since = new Map<number, string>()

  for (const run of runs) {
    const gained = new Map<number, number>()
    for (let k = 0; k < run.cells.length; k++) {
      const cell = run.cells[k]!
      const unit = index.runnableUnit.get(cell)
      if (unit === undefined || visited.has(cell)) continue
      visited.add(cell)
      counts[unit] = counts[unit]! + 1
      gained.set(unit, (gained.get(unit) ?? 0) + 1)
    }
    if (gained.size === 0) continue
    for (const u of gained.keys()) {
      if (!since.has(u) && pctOf(counts[u]!, index.units[u]!.runnable.size) >= COMPLETE_PCT) since.set(u, run.date.slice(0, 10))
    }
    const units = [...gained].map(([u, cells]): UnitGain => {
      const unit = index.units[u]!
      const total = unit.runnable.size
      return { id: unit.id, name: unit.name, cells, before: pctOf(counts[u]! - cells, total), after: pctOf(counts[u]!, total) }
    })
    units.sort((a, b) => b.cells - a.cells || a.name.localeCompare(b.name))
    byRun.set(run.id, { newCells: units.reduce((sum, u) => sum + u.cells, 0), units })
  }

  const complete = index.units.flatMap((unit, u): CompleteUnit[] => {
    const pct = pctOf(counts[u]!, unit.runnable.size)
    return pct >= COMPLETE_PCT ? [{ id: unit.id, name: unit.name, pct, since: since.get(u) ?? '' }] : []
  })
  return { byRun, complete, unitCount: index.units.filter((unit) => unit.runnable.size > 0).length }
}
