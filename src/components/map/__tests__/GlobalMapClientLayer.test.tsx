import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { AreaCoverage, ExploreAreaRef } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import { t } from '@/i18n'
import { MAP_LAYER_KEY } from '@/components/explore/mapLayer'
import type { TerritoryCardContent } from '../TerritoryBand'

// No map token: the map itself is never built, which leaves the layer state,
// its controls and the card to test. The engine is a stand-in.
const engine = vi.hoisted(() => ({
  loadArea: vi.fn(),
  addTracks: vi.fn(),
  unsent: vi.fn((_ref: unknown, ids: readonly string[]) => [...ids]),
  coverage: vi.fn(),
  fetchClusterTracks: vi.fn(),
  scoreRoutes: vi.fn(),
  routeStart: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('@/components/explore/exploreEngine', () => ({ getExploreEngine: () => engine }))

const { GlobalMapClient } = await import('../GlobalMapClient')

const AREA = testArea()
const REF: ExploreAreaRef = { id: AREA.runomics.id, name: AREA.runomics.name, version: AREA.runomics.version, bbox: AREA.runomics.bbox }
const COVERAGE: AreaCoverage = {
  areaId: REF.id,
  version: REF.version,
  units: [
    {
      id: 'test-bravo', name: 'Bravo', kind: 'quartier', commune: 'Testville', label: [-149.99, 45.001],
      visited: 2, total: 4, pct: 50, state: 'partly', kmRun: 1, lastRunDate: '2026-10-02', distanceKm: 0.6,
    },
  ],
  exploredPct: 50,
  completeCount: 0,
  unitCount: 1,
  nextId: 'test-bravo',
  home: null,
}

const BOUNDS = { minLon: -150, minLat: 45, maxLon: -149.99, maxLat: 45.01 }
function shell(labelPoint: [number, number] = [-149.995, 45.005]): MapShellData {
  return {
    routeMeta: [
      { id: 'run-a', type: 'Base', year: '2026', date: '2026-10-01', distanceKm: 5, durationSeconds: 1800, paceSecPerKm: 360 },
      { id: 'run-b', type: 'Base', year: '2026', date: '2026-10-02', distanceKm: 6, durationSeconds: 2100, paceSecPerKm: 350 },
    ],
    clusters: [{ id: 'c0', routeCount: 2, totalKm: 11, center: labelPoint, labelPoint, bounds: BOUNDS, frame: BOUNDS, routeIndices: [0, 1] }],
    defaultClusterIdx: 0,
    totalCount: 2,
    totalKm: 11,
    years: ['2026'],
  }
}

const ROUTES = {
  routes: { 0: [[-149.999, 45.001], [-149.998, 45.002]], 1: [[-149.997, 45.001], [-149.996, 45.003]] },
  ids: { 0: 'run-a', 1: 'run-b' },
}

function renderMap(data = shell(), exploreAreas: ExploreAreaRef[] = [REF]) {
  const cards: (TerritoryCardContent | null)[] = []
  render(<GlobalMapClient data={data} exploreAreas={exploreAreas} onContentChange={(c) => cards.push(c)} />)
  return { cards, lastCard: () => cards.at(-1) ?? null }
}

const layersButton = () => screen.queryByRole('button', { name: t.pages.map.districts.layersButton })

describe('the map’s layer: Heat or Districts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', '')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ROUTES), { status: 200 })))
    engine.loadArea.mockResolvedValue(AREA)
    engine.addTracks.mockResolvedValue({ added: ['run-a', 'run-b'] })
    engine.coverage.mockResolvedValue(COVERAGE)
    localStorage.clear()
    window.history.replaceState(null, '', '/activities?view=map')
  })
  afterEach(async () => {
    // Unmounted before anything is reset: a routes answer still on its way
    // would otherwise reach the next test's engine.
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 0))
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('opens on the heat, with the layers button off, and starts no worker', async () => {
    const { lastCard } = renderMap()
    await waitFor(() => expect(lastCard()?.headline.accent).toContain('ring'))
    expect(layersButton()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('heat-legend')).toBeInTheDocument()
    expect(screen.queryByTestId('districts-legend')).toBeNull()
    expect(engine.loadArea).not.toHaveBeenCalled()
  })

  it('switches to Districts on a tap, remembers it, and turns the card to quartiers', async () => {
    const { lastCard } = renderMap()
    await waitFor(() => expect(lastCard()).not.toBeNull())
    fireEvent.click(layersButton()!)

    expect(layersButton()).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('districts')
    expect(screen.getByTestId('districts-legend')).toBeInTheDocument()
    expect(screen.queryByTestId('heat-legend')).toBeNull()
    await waitFor(() => expect(lastCard()?.headline.accent).toBe('Bravo'))
    expect(lastCard()?.eyebrow).toContain(t.pages.map.allYears)
    expect(lastCard()?.action).toBeUndefined()
    expect(engine.coverage).toHaveBeenCalledWith(REF, expect.objectContaining({ activityIds: ['run-a', 'run-b'] }))

    // And back: the heat card, the heat legend.
    fireEvent.click(layersButton()!)
    expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('heat')
    expect(screen.getByTestId('heat-legend')).toBeInTheDocument()
    await waitFor(() => expect(lastCard()?.headline.accent).toContain('ring'))
  })

  it('reopens on the layer last chosen', () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    renderMap()
    expect(layersButton()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('districts-legend')).toBeInTheDocument()
  })

  it('takes ?layer=districts over the stored heat, keeps it, and leaves the address alone', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'heat')
    window.history.replaceState(null, '', '/activities?view=map&layer=districts')
    renderMap()
    expect(layersButton()).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('districts'))
    expect(window.location.search).toBe('?view=map&layer=districts')
  })

  it('gives a link’s layer up once the layer is changed by hand: a remount stays on the choice made after it', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'heat')
    window.history.replaceState(null, '', '/activities?view=map&layer=districts')
    renderMap()
    expect(layersButton()).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('districts'))

    // Back to the heat by hand: the link has done its job and leaves the address.
    fireEvent.click(layersButton()!)
    expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('heat')
    expect(window.location.search).toBe('?view=map')

    // List and back to Map (the map remounts), or Back to this entry: still the heat.
    cleanup()
    renderMap()
    expect(layersButton()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('heat-legend')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('heat')
  })

  it('keeps the layers button above the ⓘ in one column, whatever the legend beside them does', () => {
    renderMap()
    const info = screen.getByTestId('map-attribution')
    // One flex item: a legend that wraps to its own line moves up alone, never under the button.
    expect(layersButton()!.parentElement).toBe(info.parentElement)
    expect(layersButton()!.nextElementSibling).toBe(info)
    expect(info.parentElement).toHaveClass('ml-auto', 'flex-col', 'items-end')
    // Right-aligned with the Expand circle (10 pt in), the ⓘ 12 pt in.
    expect(layersButton()).toHaveClass('-mr-0.5')
  })

  it('in fullscreen, keeps the heat card’s place in Districts, so the layers button doesn’t move under the finger', async () => {
    const { lastCard } = renderMap()
    await waitFor(() => expect(lastCard()?.headline.accent).toContain('ring'))
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    const heatCard = screen.getByTestId('heat-legend')
    expect(heatCard).toHaveClass('lg')

    fireEvent.click(layersButton()!)
    expect(screen.queryByTestId('heat-legend')).toBeNull()
    expect(screen.getByTestId('districts-legend')).toBeInTheDocument()
    // The heat card's box, drawn by nothing: invisible, unread, and no glass (no blur).
    const space = screen.getByTestId('heat-legend-space')
    expect(space).toHaveClass('invisible')
    expect(space).toHaveAttribute('aria-hidden', 'true')
    expect(space).not.toHaveClass('lg')
    expect(space.querySelector('.lg-blur, .lg-edge')).toBeNull()
    // The same box as the heat card it stands in for.
    for (const cls of ['rounded-[28px]', 'px-[18px]', 'py-3.5', 'gap-2']) expect(space).toHaveClass(cls)
    // Under the layers button and the ⓘ, in the same column the heat card was in.
    expect(layersButton()!.parentElement).toBe(screen.getByTestId('map-attribution').parentElement)
    expect(space.parentElement!.parentElement).toBe(layersButton()!.parentElement)
    expect(screen.getByTestId('districts-legend').parentElement).toBe(space.parentElement)
  })

  it('has no layers button, and draws the heat, where the area on screen has no Districts', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const { lastCard } = renderMap(shell([2.35, 48.85]))
    await waitFor(() => expect(lastCard()?.headline.accent).toContain('ring'))
    expect(layersButton()).toBeNull()
    expect(screen.getByTestId('heat-legend')).toBeInTheDocument()
    expect(engine.loadArea).not.toHaveBeenCalled()
  })
})
