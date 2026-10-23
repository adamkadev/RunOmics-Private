import { COMPLETE_PCT, type AreaCoverage } from '@/domain/explore/types'

/** Free of any coordinate, home included, so it can be kept in localStorage. */
export interface ExploredSummary {
  /** floor(100 · Σvisited / Σtotal) */
  pct: number
  complete: number
  /** Units with at least one runnable cell. */
  total: number
  segments: number[]
  next: { id: string; name: string; pct: number } | null
}

/** More units than this read as one continuous bar: dozens of 3 px slivers say nothing. */
export const MAX_SEGMENTS = 24

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

const CACHE_PREFIX = 'runomics-explored:'

export function exploredCacheKey(areaVersion: string, dataVersion: string): string {
  return `${CACHE_PREFIX}${areaVersion}:${dataVersion}`
}

const isPct = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

export function parseExploredSummary(value: unknown): ExploredSummary | null {
  if (!value || typeof value !== 'object') return null
  const { pct, complete, total, segments, next } = value as Record<string, unknown>
  if (!isPct(pct) || !isCount(complete) || !isCount(total) || complete > total) return null
  if (!Array.isArray(segments) || !segments.every(isPct)) return null
  let parsedNext: ExploredSummary['next'] = null
  if (next !== null) {
    if (!next || typeof next !== 'object') return null
    const { id, name, pct: nextPct } = next as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || !isPct(nextPct)) return null
    parsedNext = { id, name, pct: nextPct }
  }
  return { pct, complete, total, segments: segments as number[], next: parsedNext }
}

export function readExploredCache(key: string): ExploredSummary | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? parseExploredSummary(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function writeExploredCache(key: string, summary: ExploredSummary): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const stored = localStorage.key(i)
      if (stored?.startsWith(CACHE_PREFIX) && stored !== key) localStorage.removeItem(stored)
    }
    localStorage.setItem(key, JSON.stringify(summary))
  } catch {
    // Private mode or storage full: the card is worked out again next time.
  }
}
