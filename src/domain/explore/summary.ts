import { COMPLETE_PCT, type AreaCoverage } from './types'

/** Free of any coordinate, home included: this, not the coverage, is what leaves the server. */
export interface ExploredSummary {
  /** floor(100 · Σvisited / Σtotal) */
  pct: number
  complete: number
  /** Units with at least one runnable cell. */
  total: number
  segments: number[]
  next: { id: string; name: string; pct: number } | null
}

export function isComplete(pct: number): boolean {
  return pct >= COMPLETE_PCT
}

export function exploredSummary(coverage: AreaCoverage): ExploredSummary {
  const next = coverage.nextId ? coverage.units.find((unit) => unit.id === coverage.nextId) : undefined
  return {
    pct: coverage.exploredPct,
    complete: coverage.completeCount,
    total: coverage.unitCount,
    segments: coverage.units.map((unit) => unit.pct).sort((a, b) => b - a),
    next: next ? { id: next.id, name: next.name, pct: next.pct } : null,
  }
}
