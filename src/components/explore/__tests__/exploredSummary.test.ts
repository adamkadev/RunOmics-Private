import { describe, expect, it } from 'vitest'
import type { AreaCoverage, UnitCoverage } from '@/domain/explore/types'
import { exploredCacheKey, exploredSummary, isComplete, parseExploredSummary } from '../exploredSummary'

function unit(id: string, name: string, pct: number): UnitCoverage {
  return {
    id,
    name,
    kind: 'quartier',
    commune: 'Bayside',
    label: [-150, 0],
    visited: pct,
    total: 100,
    pct,
    state: pct >= 90 ? 'complete' : pct < 15 ? 'fog' : 'partly',
    kmRun: 1,
    lastRunDate: null,
    distanceKm: 1.2,
  }
}

const COVERAGE: AreaCoverage = {
  areaId: 'bay',
  version: 'bay-20261001-abcdef12',
  units: [unit('bay-a', 'Harbour', 12), unit('bay-b', 'Old Town', 96), unit('bay-c', 'Docks', 40), unit('bay-d', 'Hill', 100)],
  exploredPct: 52,
  completeCount: 2,
  unitCount: 4,
  nextId: 'bay-a',
  home: [-150.0012, 0.0034],
}

describe('exploredSummary', () => {
  it('keeps the share, the counts, a pct per unit best first, and the next quartier', () => {
    expect(exploredSummary(COVERAGE)).toEqual({
      pct: 52,
      complete: 2,
      total: 4,
      segments: [100, 96, 40, 12],
      next: { id: 'bay-a', name: 'Harbour', pct: 12 },
    })
  })

  it('keeps no coordinate: home and the units’ labels stay out of storage', () => {
    const stored = JSON.stringify(exploredSummary(COVERAGE))
    expect(stored).not.toContain('-150')
    expect(stored).not.toContain('home')
  })

  it('has no next quartier when every one is complete', () => {
    expect(exploredSummary({ ...COVERAGE, nextId: null }).next).toBeNull()
  })

  it('calls 90% complete, as the map does', () => {
    expect(isComplete(90)).toBe(true)
    expect(isComplete(89)).toBe(false)
  })
})

describe('the stored summary', () => {
  it('is keyed by the area file and the set of runs', () => {
    expect(exploredCacheKey('bay-20261001-abcdef12', '0123456789ab')).toBe('runomics-explored:bay-20261001-abcdef12:0123456789ab')
  })

  it('reads back what was written', () => {
    const summary = exploredSummary(COVERAGE)
    expect(parseExploredSummary(JSON.parse(JSON.stringify(summary)))).toEqual(summary)
    expect(parseExploredSummary({ ...summary, next: null })).toEqual({ ...summary, next: null })
  })

  it('refuses anything that is not one', () => {
    const summary = exploredSummary(COVERAGE)
    expect(parseExploredSummary(null)).toBeNull()
    expect(parseExploredSummary('52')).toBeNull()
    expect(parseExploredSummary({ ...summary, pct: 140 })).toBeNull()
    expect(parseExploredSummary({ ...summary, complete: 5 })).toBeNull()
    expect(parseExploredSummary({ ...summary, segments: [50, 'x'] })).toBeNull()
    expect(parseExploredSummary({ ...summary, next: { id: 'bay-a' } })).toBeNull()
    expect(parseExploredSummary({ ...summary, next: undefined })).toBeNull()
  })
})
