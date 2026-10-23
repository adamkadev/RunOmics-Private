import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaCoverage, ExploreAreaRef, UnitCoverage } from '@/domain/explore/types'
import { t } from '@/i18n'
import { en } from '@/i18n/en'
import { fr } from '@/i18n/fr'
import type { ExploreEngine } from '../exploreEngine'
import { ExploredCard } from '../ExploredCard'
import { exploredCacheKey, exploredSummary } from '../exploredSummary'

const AREA: ExploreAreaRef = { id: 'bay', name: 'Bayside', version: 'bay-20261001-abcdef12', bbox: [-150.05, -0.05, -149.95, 0.05] }
const RUNS = [
  { routeIdx: 0, id: 'run-a', date: '2026-10-01' },
  { routeIdx: 3, id: 'run-b', date: '2026-10-02' },
]

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

function coverageOf(units: UnitCoverage[], nextId: string | null, exploredPct = 52): AreaCoverage {
  return {
    areaId: AREA.id,
    version: AREA.version,
    units,
    exploredPct,
    completeCount: units.filter((u) => u.pct >= 90).length,
    unitCount: units.length,
    nextId,
    home: [-150.0012, 0.0034],
  }
}

const NINE = [
  unit('bay-a', 'Harbour', 100),
  unit('bay-b', 'Old Town', 96),
  unit('bay-c', 'Docks', 91),
  unit('bay-d', 'Hill', 60),
  unit('bay-e', 'Borny', 12),
  unit('bay-f', 'Sablon', 4),
  unit('bay-g', 'Queuleu', 9),
  unit('bay-h', 'Gare', 45),
  unit('bay-i', 'Bridge', 30),
]

function fakeEngine(coverage: () => Promise<AreaCoverage>) {
  const engine = {
    loadArea: vi.fn(async () => ({}) as never),
    fetchClusterTracks: vi.fn(async () => ({ added: [] })),
    coverage: vi.fn(coverage),
  }
  return engine
}

// Every test its own data version: the card shares summaries in flight by key.
let version = 0
function props(engine: ReturnType<typeof fakeEngine> | null) {
  version += 1
  const engineFor = vi.fn(() => engine as unknown as ExploreEngine)
  return { area: AREA, clusterId: 'c-7', runs: RUNS, dataVersion: `dv-${version}`, engineFor }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('ExploredCard', () => {
  it('holds its place with a skeleton while the coverage is worked out, already a way into Districts', () => {
    const engine = fakeEngine(() => new Promise(() => {}))
    render(<ExploredCard {...props(engine)} />)

    const card = screen.getByTestId('explored-card')
    expect(card.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByTestId('explored-skeleton')).toBeInTheDocument()
    expect(card.textContent).toContain(t.profile.hub.explored)
    expect(card.textContent).toContain('Bayside')
    expect(screen.getByTestId('explored-open').getAttribute('href')).toBe('/activities?view=map&layer=districts')
    expect(screen.queryByTestId('explored-next')).toBeNull()
    // Same rows as the card it stands for: a 48 pt hero, the bar, the footer row.
    expect(screen.getByTestId('explored-skeleton').className).toContain('h-12')
    expect(screen.getByTestId('explored-bar')).toBeInTheDocument()
  })

  it('asks the worker for the cluster’s runs and their coverage from their own median start', async () => {
    const engine = fakeEngine(async () => coverageOf(NINE, 'bay-e'))
    const p = props(engine)
    render(<ExploredCard {...p} />)

    await screen.findByTestId('explored-pct')
    expect(engine.loadArea).toHaveBeenCalledWith(AREA)
    expect(engine.fetchClusterTracks).toHaveBeenCalledWith(AREA, 'c-7', RUNS)
    // Its own runs alone: the map may have added another cluster's to the same area.
    expect(engine.coverage).toHaveBeenCalledWith(AREA, { activityIds: RUNS.map((r) => r.id), home: null, homeFromTracks: true })
  })

  it('reads the explored share, the quartiers complete, a segment each and the next one (E5)', async () => {
    const engine = fakeEngine(async () => coverageOf(NINE, 'bay-e'))
    render(<ExploredCard {...props(engine)} />)

    expect((await screen.findByTestId('explored-pct')).textContent).toBe('52%')
    expect(screen.getByTestId('explored-complete').textContent).toBe(t.profile.hub.exploredComplete(3, 9))
    expect(screen.getByTestId('explored-card').getAttribute('aria-busy')).toBeNull()

    const segments = screen.getAllByTestId('explored-segment')
    expect(segments).toHaveLength(9)
    // Best first; complete reads whole even at 91%, the rest the accent at 60% to their share.
    expect(segments.map((s) => s.hasAttribute('data-complete'))).toEqual([true, true, true, false, false, false, false, false, false])
    const fills = segments.map((s) => (s.firstElementChild as HTMLElement).style)
    expect(fills.map((f) => f.width)).toEqual(['100%', '100%', '100%', '60%', '45%', '30%', '12%', '9%', '4%'])
    expect(fills[0]!.background).toBe('var(--accent)')
    expect(fills[3]!.background).toContain('color-mix(in srgb, var(--accent) 60%, transparent)')

    const next = screen.getByTestId('explored-next')
    expect(next.textContent).toBe('Next: Borny · 12%')
    expect(within(next).getByText('Borny').tagName).toBe('B')
    expect(next.getAttribute('href')).toBe('/activities?view=map&layer=districts&quartier=bay-e')
    // Two sibling links, never one in the other.
    expect(screen.getByTestId('explored-open').contains(next)).toBe(false)
    expect(next.querySelector('a')).toBeNull()
  })

  it('draws one bar of the whole area past 24 quartiers', async () => {
    const many = Array.from({ length: 30 }, (_, i) => unit(`bay-${i}`, `Unit ${i}`, i * 3))
    const engine = fakeEngine(async () => coverageOf(many, 'bay-1', 41))
    render(<ExploredCard {...props(engine)} />)

    await screen.findByTestId('explored-pct')
    expect(screen.queryByTestId('explored-segment')).toBeNull()
    expect((screen.getByTestId('explored-bar').firstElementChild as HTMLElement).style.width).toBe('41%')
  })

  it('says so when every quartier is complete, the row opening Districts', async () => {
    const engine = fakeEngine(async () => coverageOf([unit('bay-a', 'Harbour', 100), unit('bay-b', 'Old Town', 94)], null, 97))
    render(<ExploredCard {...props(engine)} />)

    const next = await screen.findByTestId('explored-next')
    expect(next.textContent).toBe(t.profile.hub.exploredAllComplete(2))
    expect(next.getAttribute('href')).toBe('/activities?view=map&layer=districts')
  })

  it('keeps the summary - and no coordinate - for the next visit, dropping older ones', async () => {
    localStorage.setItem('runomics-explored:bay-old:dv-old', '{}')
    localStorage.setItem('runomics-map-layer', 'districts')
    const engine = fakeEngine(async () => coverageOf(NINE, 'bay-e'))
    const p = props(engine)
    render(<ExploredCard {...p} />)
    await screen.findByTestId('explored-pct')

    const key = exploredCacheKey(AREA.version, p.dataVersion)
    const stored = localStorage.getItem(key)!
    expect(JSON.parse(stored)).toEqual(exploredSummary(coverageOf(NINE, 'bay-e')))
    expect(stored).not.toContain('-150')
    expect(localStorage.getItem('runomics-explored:bay-old:dv-old')).toBeNull()
    expect(localStorage.getItem('runomics-map-layer')).toBe('districts')
  })

  it('draws a stored summary at once, without starting the worker', () => {
    const p = props(null)
    localStorage.setItem(exploredCacheKey(AREA.version, p.dataVersion), JSON.stringify(exploredSummary(coverageOf(NINE, 'bay-e'))))
    render(<ExploredCard {...p} />)

    expect(screen.getByTestId('explored-pct').textContent).toBe('52%')
    expect(screen.getByTestId('explored-next').textContent).toBe('Next: Borny · 12%')
    expect(p.engineFor).not.toHaveBeenCalled()
  })

  it('works the summary out again for other runs', async () => {
    const p = props(null)
    localStorage.setItem(exploredCacheKey(AREA.version, 'dv-stale'), JSON.stringify(exploredSummary(coverageOf(NINE, 'bay-e'))))
    const engine = fakeEngine(async () => coverageOf(NINE, 'bay-d', 61))
    p.engineFor.mockReturnValue(engine as unknown as ExploreEngine)
    render(<ExploredCard {...p} />)

    expect((await screen.findByTestId('explored-pct')).textContent).toBe('61%')
  })

  it('ignores a stored value that is not a summary', async () => {
    const engine = fakeEngine(async () => coverageOf(NINE, 'bay-e'))
    const p = props(engine)
    localStorage.setItem(exploredCacheKey(AREA.version, p.dataVersion), '{"pct":"lots"}')
    render(<ExploredCard {...p} />)

    expect((await screen.findByTestId('explored-pct')).textContent).toBe('52%')
    expect(engine.coverage).toHaveBeenCalledTimes(1)
  })

  it('leaves the hub quietly when the coverage fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const engine = fakeEngine(async () => {
      throw new Error('worker gone')
    })
    const { container } = render(<ExploredCard {...props(engine)} />)

    await waitFor(() => expect(container.innerHTML).toBe(''))
    expect(warn).toHaveBeenCalled()
  })

  it('leaves the hub quietly when there is no worker at all', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const engine = fakeEngine(async () => coverageOf(NINE, 'bay-e'))
    engine.loadArea.mockRejectedValue(new Error('Worker is not defined'))
    const { container } = render(<ExploredCard {...props(engine)} />)

    await waitFor(() => expect(container.innerHTML).toBe(''))
    expect(engine.coverage).not.toHaveBeenCalled()
  })
})

describe('the Explored card’s copy', () => {
  it('counts quartiers in English, 1 in the singular', () => {
    expect(en.profile.hub.exploredComplete(3, 9)).toBe('3 of 9 quartiers complete')
    expect(en.profile.hub.exploredComplete(1, 1)).toBe('1 of 1 quartier complete')
    expect(en.profile.hub.exploredNext('Borny', '12%')).toEqual({ lead: 'Next: ', name: 'Borny', tail: ' · 12%' })
  })

  it('counts them in French, 0 and 1 in the singular', () => {
    expect(fr.profile.hub.exploredComplete(0, 9)).toBe('0 quartier complet sur 9')
    expect(fr.profile.hub.exploredComplete(1, 9)).toBe('1 quartier complet sur 9')
    expect(fr.profile.hub.exploredComplete(3, 9)).toBe('3 quartiers complets sur 9')
    expect(fr.profile.hub.exploredNext('Borny', '12 %').lead).toBe('Prochain : ')
    expect(fr.profile.hub.exploredAllComplete(1)).toBe('Ton quartier est complet')
  })
})
