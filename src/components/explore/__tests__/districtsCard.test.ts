import { describe, expect, it, vi } from 'vitest'
import type { AreaCoverage, UnitCoverage } from '@/domain/explore/types'
import { t } from '@/i18n'
import { districtsCardContent } from '../districtsCard'

const d = t.pages.map.districts

function unit(id: string, name: string, pct: number, distanceKm: number | null): UnitCoverage {
  return {
    id,
    name,
    kind: 'quartier',
    commune: 'Testville',
    label: [0, 0],
    visited: pct,
    total: 100,
    pct,
    state: pct >= 90 ? 'complete' : pct >= 15 ? 'partly' : 'fog',
    kmRun: 0,
    lastRunDate: null,
    distanceKm,
  }
}

function coverage(units: UnitCoverage[], nextId: string | null): AreaCoverage {
  return {
    areaId: 'test',
    version: 'v1',
    units,
    exploredPct: 65,
    completeCount: units.filter((u) => u.state === 'complete').length,
    unitCount: units.length,
    nextId,
    home: null,
  }
}

const SIX = coverage(
  [unit('a', 'Alpha', 95, 0.4), unit('b', 'Bravo', 92, 1), unit('n', 'Nouvelle Ville', 8, 1.9), unit('c', 'C', 40, 2), unit('d', 'D', 20, 3), unit('e', 'E', 5, 4)],
  'n',
)

describe('districtsCardContent', () => {
  it('names the next quartier and how far it is, under the heat card’s eyebrow', () => {
    const card = districtsCardContent('METZ · ALL YEARS', { coverage: SIX, status: 'ready' })
    expect(card.eyebrow).toBe('METZ · ALL YEARS')
    expect(card.headline).toEqual({ lead: '2 of 6 quartiers complete. ', accent: 'Nouvelle Ville', tail: ' is next, 1.9 km from home.' })
    expect(card.stats).toEqual([
      { label: d.completeStat, value: '2', unit: 'of 6' },
      { label: d.exploredStat, value: '65', unit: '%' },
      { label: d.nextStat, value: '1.9', unit: 'km' },
    ])
  })

  it('has no button until there is a way to plan the run', () => {
    expect(districtsCardContent('E', { coverage: SIX, status: 'ready' }).action).toBeUndefined()
    const onPlanRun = vi.fn()
    const card = districtsCardContent('E', { coverage: SIX, status: 'ready' }, onPlanRun)
    expect(card.action?.label).toBe('Plan a run in Nouvelle Ville')
    card.action?.onClick()
    expect(onPlanRun).toHaveBeenCalledWith('n')
  })

  it('leaves the distance out when home is unknown', () => {
    const noHome = coverage([unit('n', 'Nouvelle Ville', 8, null)], 'n')
    const card = districtsCardContent('E', { coverage: noHome, status: 'ready' })
    expect(card.headline.tail).toBe(' is next.')
    expect(card.stats[2]).toEqual({ label: d.nextStat, value: '—', unit: undefined })
  })

  it('says so when every quartier is complete', () => {
    const done = coverage([unit('a', 'Alpha', 95, 1), unit('b', 'Bravo', 91, 2)], null)
    const card = districtsCardContent('E', { coverage: done, status: 'ready' }, vi.fn())
    expect(card.headline).toEqual({ lead: 'All 2 quartiers complete.', accent: '', tail: '' })
    expect(card.action).toBeUndefined()
  })

  it('keeps its shape with dashes while the coverage is on its way, and says when it failed', () => {
    const loading = districtsCardContent('E', { coverage: null, status: 'loading' })
    expect(loading.headline).toEqual(d.loading)
    expect(loading.stats.map((s) => s.value)).toEqual(['—', '—', '—'])
    expect(loading.stats).toHaveLength(3)
    expect(districtsCardContent('E', { coverage: null, status: 'error' }).headline).toEqual(d.failed)
  })

  it('marks the stand-in sentence as pending, so the card holds the height of the one it replaces', () => {
    expect(districtsCardContent('E', { coverage: null, status: 'loading' }).pending).toBe(true)
    expect(districtsCardContent('E', { coverage: null, status: 'error' }).pending).toBe(true)
    expect(districtsCardContent('E', { coverage: SIX, status: 'ready' }).pending).toBeUndefined()
  })
})
