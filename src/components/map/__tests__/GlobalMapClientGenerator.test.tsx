import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { AreaCoverage, ExploreAreaRef, RouteCandidate, ScoredRoute } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import { t } from '@/i18n'
import { MAP_LAYER_KEY } from '@/components/explore/mapLayer'
import type { ExplorePlan } from '@/components/explore/routeGenerator'
import type { NavigationOrigin } from '@/lib/navigation'
import type { TerritoryCardContent } from '../TerritoryBand'
import type { FakeMap } from '@/components/explore/__tests__/fakeMap'
import { DISTRICTS_FILL_LAYER, DISTRICTS_NEXT_LABEL_LAYER } from '@/components/explore/districtsLayer'
import { ROUTE_LAYERS, ROUTE_SOURCE } from '@/components/explore/routeLayer'
import { unitBounds } from '@/components/explore/quartierCamera'
import { TAP_OPEN_DELAY_MS } from '@/components/explore/useQuartierMap'

// The map page's route generator (S3), with no map token (the map itself is
// never built: the generator is a DOM path), a stand-in engine, router and
// owner check, and a routing proxy that answers from a fixture. What is
// under test: what opens it (a link, or "Plan a run" from the card, the
// expanded map's card and a quartier's sheet), what it opens on, and where
// Back and the X take the athlete.
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

const nav = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn(), origin: null as NavigationOrigin | null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: nav.back, push: nav.push }), usePathname: () => '/activities' }))
vi.mock('@/components/layout/NavigationHistory', () => ({ useNavigationOrigin: () => nav.origin }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ user: null, isOwner: false, loading: false }) }))

const maps = vi.hoisted(() => ({ built: [] as FakeMap[] }))
vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  const { FakeMap } = await import('@/components/explore/__tests__/fakeMap')
  class RecordedMap extends FakeMap {
    constructor(options: { style?: unknown; container?: unknown }) {
      super(options)
      maps.built.push(this)
    }
  }
  return { ...real, loadMapLibre: async () => ({ Map: RecordedMap }) }
})
vi.mock('../heatLayer', () => ({
  HEAT_LAYER: 'heat',
  HEAT_SOURCE: 'heat',
  addHeatLayer: (map: FakeMap, _mode: string, _accent: string, beforeId?: string) => {
    map.addSource('heat', { type: 'canvas' })
    map.addLayer({ id: 'heat', type: 'raster', source: 'heat' }, beforeId)
    return {
      setTracks() {},
      remove() {
        if (map.getLayer('heat')) map.removeLayer('heat')
        if (map.getSource('heat')) map.removeSource('heat')
      },
    }
  },
}))
vi.mock('@/lib/reverseGeocode', () => ({ reverseGeocode: async () => null }))

const { GlobalMapClient } = await import('../GlobalMapClient')

const e = t.pages.map.explore
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
    {
      id: 'test-delta', name: 'Delta', kind: 'quartier', commune: 'Testville', label: [-149.99, 45.003],
      visited: 1, total: 10, pct: 10, state: 'fog', kmRun: 0.4, lastRunDate: '2026-10-01', distanceKm: 0.9,
    },
  ],
  exploredPct: 21,
  completeCount: 0,
  unitCount: 2,
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
const START: [number, number] = [-149.992, 45.0005]
const loop = (seed: number, distanceM: number): RouteCandidate => ({
  seed,
  coordinates: [START, [-149.99, 45.0005, 190], [-149.99, 45.001, 195], START],
  distanceM,
  durationS: 0,
  ascentM: 24,
  descentM: 24,
  waytypes: [],
})
const TODAY = '2026-10-22'
const PLAN: ExplorePlan = { date: TODAY, label: 'Easy · 8 km + 6 strides', distanceM: 9462, paceSecPerKm: 353 }
/** Saturday's long run: the plan Plan's "Find a route" on that day names. */
const SATURDAY: ExplorePlan = { date: '2026-10-24', label: 'Long run', distanceM: 16000, paceSecPerKm: 345 }

const routeCalls = () =>
  (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).includes('/api/explore/route')).map(([, init]) => JSON.parse(init.body))

function renderMap({ data = shell(), plans = [] }: { data?: MapShellData; plans?: ExplorePlan[] } = {}) {
  const cards: (TerritoryCardContent | null)[] = []
  render(<GlobalMapClient data={data} exploreAreas={[REF]} explorePlans={plans} today={TODAY} onContentChange={(c) => cards.push(c)} />)
  return { lastCard: () => cards.at(-1) ?? null }
}

const panel = () => screen.queryByTestId('route-generator')
const stats = () => within(screen.getByTestId('route-stats'))
const ready = () => waitFor(() => expect(stats().getByText('8.1 km')).toBeInTheDocument())
const closeByX = async () => {
  fireEvent.click(within(panel()!).getByRole('button', { name: t.common.close }))
  await waitFor(() => expect(panel()).toBeNull())
}

describe('the route generator on the map (S3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.origin = null
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', '')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/explore/route')) {
          const body = JSON.parse(String(init!.body))
          return new Response(JSON.stringify({ candidates: body.seeds.map((s: number) => loop(s, 8100)), attribution: '' }), { status: 200 })
        }
        return new Response(JSON.stringify(ROUTES), { status: 200 })
      }),
    )
    engine.loadArea.mockResolvedValue(AREA)
    engine.addTracks.mockResolvedValue({ added: ['run-a', 'run-b'] })
    engine.coverage.mockResolvedValue(COVERAGE)
    engine.routeStart.mockResolvedValue(START)
    engine.scoreRoutes.mockImplementation(async (_ref: unknown, req: { candidates: RouteCandidate[] }) =>
      req.candidates.map((candidate): ScoredRoute => ({ candidate, score: 0, newShare: 0.94, busyShare: 0, newSteps: [true, true, false] })),
    )
    localStorage.clear()
    window.history.replaceState(null, '', '/activities?view=map')
  })
  afterEach(async () => {
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 0))
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('opens from a link on its quartier, distance and pace, expanded on Districts, and leaves the address alone', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&quartier=test-delta&km=9.5&pace=353&from=plan')
    renderMap()
    expect(await screen.findByRole('dialog', { name: e.title('Delta') })).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByTestId('heatmap')).toHaveClass('fixed')
    expect(screen.getByTestId('route-distance')).toHaveTextContent('9.5 km')
    await waitFor(() => expect(stats().getByText('8.1 km')).toBeInTheDocument())
    expect(stats().getByText(e.atPace('5:53'))).toBeInTheDocument()
    expect(stats().getByText('94%')).toBeInTheDocument()
    expect(screen.getByTestId('route-generator-pill')).toHaveTextContent(`Delta· ${e.loop} · ${e.newShare('94%')}`)
    // Its own controls in place of the filter row, the legend, the layers button and the cards.
    expect(screen.queryByTestId('heat-filter-row')).toBeNull()
    for (const id of ['districts-legend', 'layers-button', 'next-quartier-card', 'heat-legend']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.getByRole('button', { name: e.back })).toBeInTheDocument()
    // The link's quartier is the generator's, not a sheet's.
    expect(screen.queryByTestId('quartier-sheet')).toBeNull()
    expect(routeCalls()).toEqual([{ start: START, distanceM: 9500, seeds: [1, 2, 3, 4, 5], avoidBusyRoads: true }])
    expect(engine.routeStart).toHaveBeenCalledWith(REF, { unitId: 'test-delta' })
    expect(window.location.search).toBe('?view=map&explore=route&quartier=test-delta&km=9.5&pace=353&from=plan')
  })

  it('opens on Districts without making it the layer the map opens on next time', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'heat')
    window.history.replaceState(null, '', '/activities?view=map&explore=route&from=plan')
    renderMap()
    await screen.findByTestId('route-generator')
    await ready()
    await closeByX()
    // Closed, this map stays on Districts...
    expect(screen.getByTestId('districts-legend')).toBeInTheDocument()
    expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('heat')

    // ...and the next visit opens on the heat, as the athlete left it.
    cleanup()
    window.history.replaceState(null, '', '/activities?view=map')
    renderMap()
    expect(await screen.findByTestId('heat-legend')).toBeInTheDocument()
    expect(screen.queryByTestId('districts-legend')).toBeNull()
  })

  it('credits the quartiers’ source and the loops’ provider in its ⓘ', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route')
    renderMap()
    await screen.findByTestId('route-generator')
    await waitFor(() => expect(engine.loadArea).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.credits }))
    const note = screen.getByRole('note')
    await waitFor(() => expect(note).toHaveTextContent('Test shapes'))
    expect(within(note).getByRole('link', { name: /openrouteservice/ })).toHaveAttribute('href', 'https://openrouteservice.org/terms-of-service/')
  })

  it('takes the next quartier without one, or for one the area doesn’t know', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&quartier=test-zulu')
    renderMap()
    expect(await screen.findByRole('dialog', { name: e.title('Bravo') })).toBeInTheDocument()
    await waitFor(() => expect(engine.routeStart).toHaveBeenCalledWith(REF, { unitId: 'test-bravo' }))
  })

  it('opens on today’s plan: its row, its distance and pace', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route')
    renderMap({ plans: [PLAN, SATURDAY] })
    await screen.findByTestId('route-generator')
    expect(screen.getByText('Easy · 8 km + 6 strides')).toBeInTheDocument()
    expect(screen.getByTestId('route-distance')).toHaveTextContent('9.5 km')
    expect(screen.getByTestId('route-plan-check')).toBeInTheDocument()
    await ready()
    expect(stats().getByText(e.atPace('5:53'))).toBeInTheDocument()
  })

  it('opens a Plan link for another day on that day’s session - its row, its pace - never today’s', async () => {
    // Saturday's long run, a session with no duration: the link brings its distance and day.
    window.history.replaceState(null, '', '/activities?view=map&explore=route&km=16&date=2026-10-24&from=plan')
    renderMap({ plans: [PLAN, SATURDAY] })
    await screen.findByTestId('route-generator')
    const row = screen.getByTestId('route-plan')
    expect(row).toHaveTextContent(e.planFor('Sat 24'))
    expect(row).toHaveTextContent('Long run')
    expect(row).not.toHaveTextContent(PLAN.label)
    expect(screen.queryByText(e.todaysPlan)).toBeNull()
    expect(screen.getByTestId('route-distance')).toHaveTextContent('16.0 km')
    expect(screen.getByTestId('route-plan-check')).toBeInTheDocument()
    await ready()
    expect(stats().getByText(e.atPace('5:45'))).toBeInTheDocument()
  })

  it('has no plan row for a linked day the plan has nothing on, and works the time out at the usual pace here', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&km=16&date=2026-10-30&from=plan')
    renderMap({ plans: [PLAN, SATURDAY] })
    await screen.findByTestId('route-generator')
    expect(screen.queryByTestId('route-plan')).toBeNull()
    await ready()
    // The median run here, 5:55 - not today's plan's 5:53.
    expect(stats().getByText(e.atPace('5:55'))).toBeInTheDocument()
  })

  it('ignores a link where the home area has no Districts', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route')
    const { lastCard } = renderMap({ data: shell([2.35, 48.85]) })
    await waitFor(() => expect(lastCard()?.headline.accent).toContain('ring'))
    expect(panel()).toBeNull()
    expect(screen.getByTestId('heat-filter-row')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=map&explore=route')
  })

  it('Back goes back to Plan through history when Plan is the page just left', async () => {
    nav.origin = { path: '/plan', isImmediate: true }
    window.history.replaceState(null, '', '/activities?view=map&explore=route&from=plan')
    renderMap()
    fireEvent.click(await screen.findByRole('button', { name: e.back }))
    expect(nav.back).toHaveBeenCalledOnce()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('Back opens Progress when it isn’t the page just left (a cold start)', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&from=profile')
    renderMap()
    fireEvent.click(await screen.findByRole('button', { name: e.back }))
    expect(nav.push).toHaveBeenCalledWith('/profile')
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('Back without an origin closes the generator onto the map card, on Districts, its parameters out of the address', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&quartier=test-bravo&km=6')
    renderMap()
    fireEvent.click(await screen.findByRole('button', { name: e.back }))
    await waitFor(() => expect(panel()).toBeNull())
    expect(nav.back).not.toHaveBeenCalled()
    expect(nav.push).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?view=map')
    expect(screen.getByTestId('heatmap')).not.toHaveClass('fixed')
    expect(screen.getByTestId('heat-filter-row')).toBeInTheDocument()
    expect(screen.getByTestId('districts-legend')).toBeInTheDocument()
    expect(screen.queryByTestId('quartier-sheet')).toBeNull()
  })

  it('the X and Escape close it too', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&from=plan')
    renderMap()
    await screen.findByTestId('route-generator')
    await closeByX()
    expect(window.location.search).toBe('?view=map')
    expect(nav.back).not.toHaveBeenCalled()

    cleanup()
    window.history.replaceState(null, '', '/activities?view=map&explore=route')
    renderMap()
    await screen.findByTestId('route-generator')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(panel()).toBeNull())
    expect(window.location.search).toBe('?view=map')
  })

  it('“Plan a run in …” on the card opens it on the next quartier at the usual run here, and the X gives the card back', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const { lastCard } = renderMap()
    await waitFor(() => expect(lastCard()?.action?.label).toBe(t.pages.map.districts.planRunIn('Bravo')))
    act(() => lastCard()!.action!.onClick())
    expect(await screen.findByRole('dialog', { name: e.title('Bravo') })).toBeInTheDocument()
    // The median run here: 5.5 km at 5:55.
    expect(screen.getByTestId('route-distance')).toHaveTextContent('5.5 km')
    await ready()
    expect(stats().getByText(e.atPace('5:55'))).toBeInTheDocument()
    expect(window.location.search).toBe('?view=map')

    await closeByX()
    expect(screen.getByTestId('heatmap')).not.toHaveClass('fixed')
    expect(screen.getByTestId('districts-legend')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=map')
  })

  it('“Plan a run” on the expanded map’s card opens it there; closed, the map is still expanded', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    renderMap()
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    const card = await screen.findByTestId('next-quartier-card')
    fireEvent.click(within(card).getByRole('button', { name: t.pages.map.districts.planRun }))
    expect(await screen.findByRole('dialog', { name: e.title('Bravo') })).toBeInTheDocument()
    expect(screen.queryByTestId('next-quartier-card')).toBeNull()

    await closeByX()
    expect(screen.getByRole('button', { name: t.pages.map.exitFullscreen })).toBeInTheDocument()
    expect(screen.getByTestId('next-quartier-card')).toBeInTheDocument()
  })

  it('takes focus into its panel, and gives it back to the expanded map’s card when the X or Escape closes it', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    renderMap()
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    for (const close of ['x', 'escape'] as const) {
      const button = within(await screen.findByTestId('next-quartier-card')).getByRole('button', { name: t.pages.map.districts.planRun })
      button.focus()
      fireEvent.click(button)
      // The card went with its button; the panel has focus, named by its title.
      await waitFor(() => expect(document.activeElement).toBe(panel()))
      expect(document.activeElement).toHaveAccessibleName(e.title('Bravo'))

      if (close === 'x') await closeByX()
      else {
        fireEvent.keyDown(document, { key: 'Escape' })
        await waitFor(() => expect(panel()).toBeNull())
      }
      // A new card, its button focused.
      const again = within(screen.getByTestId('next-quartier-card')).getByRole('button', { name: t.pages.map.districts.planRun })
      expect(again).not.toBe(button)
      expect(document.activeElement).toBe(again)
    }
  })

  it('gives focus to the expand button when a link’s generator closes', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route')
    renderMap()
    await waitFor(() => expect(document.activeElement).toBe(panel()))
    await closeByX()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: t.pages.map.fullscreen }))
  })

  it('“Plan a run here” on a quartier’s sheet opens it on that quartier; closed, the sheet is back', async () => {
    window.history.replaceState(null, '', '/activities?view=map&layer=districts&quartier=test-delta')
    renderMap()
    const sheet = await screen.findByRole('dialog', { name: 'Delta' })
    fireEvent.click(within(sheet).getByRole('button', { name: t.pages.map.districts.sheet.planRunHere }))
    expect(await screen.findByRole('dialog', { name: e.title('Delta') })).toBeInTheDocument()
    expect(screen.queryByTestId('quartier-sheet')).toBeNull()
    await waitFor(() => expect(engine.routeStart).toHaveBeenCalledWith(REF, { unitId: 'test-delta' }))

    await closeByX()
    expect(await screen.findByRole('dialog', { name: 'Delta' })).toBeInTheDocument()
    // The sheet's own link stays in the address until the sheet closes.
    expect(window.location.search).toBe('?view=map&layer=districts&quartier=test-delta')
  })

  it('Regenerate shows the next loop; a new distance asks again once the stepper rests', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&km=8')
    renderMap()
    await screen.findByTestId('route-generator')
    await ready()
    fireEvent.click(screen.getByRole('button', { name: e.regenerate }))
    expect(routeCalls()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: e.longer }))
    fireEvent.click(screen.getByRole('button', { name: e.longer }))
    expect(screen.getByTestId('route-distance')).toHaveTextContent('9.0 km')
    await waitFor(() => expect(routeCalls()).toHaveLength(2))
    expect(routeCalls()[1]).toMatchObject({ distanceM: 9000, seeds: [1, 2, 3, 4, 5] })
  })
})

describe('the route generator on the map itself', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maps.built.length = 0
    nav.origin = null
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/explore/route')) {
          const body = JSON.parse(String(init!.body))
          return new Response(JSON.stringify({ candidates: body.seeds.map((s: number) => loop(s, 8100)), attribution: '' }), { status: 200 })
        }
        return new Response(JSON.stringify(ROUTES), { status: 200 })
      }),
    )
    engine.loadArea.mockResolvedValue(AREA)
    engine.addTracks.mockResolvedValue({ added: ['run-a', 'run-b'] })
    engine.coverage.mockResolvedValue(COVERAGE)
    engine.routeStart.mockResolvedValue(START)
    engine.scoreRoutes.mockImplementation(async (_ref: unknown, req: { candidates: RouteCandidate[] }) =>
      req.candidates.map((candidate): ScoredRoute => ({ candidate, score: 0, newShare: 0.94, busyShare: 0, newSteps: [true, true, false] })),
    )
    localStorage.clear()
  })
  afterEach(async () => {
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 0))
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('draws the loop, names its quartier alone, frames both, opens no sheet on a tap, and leaves the map clean on close', async () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&quartier=test-delta')
    renderMap()
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    act(() => map.finish())
    await ready()
    await waitFor(() => expect((map.getSource(ROUTE_SOURCE)?.data as { features?: unknown[] } | undefined)?.features?.length).toBeGreaterThan(0))
    for (const id of ROUTE_LAYERS) expect(map.getLayer(id)).toBeDefined()
    expect(JSON.stringify(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER))).toContain('test-delta')

    // The camera: the quartier and the loop, together.
    const unit = unitBounds(AREA, 'test-delta')!
    const fit = map.fits.at(-1)!
    expect(fit.bounds).toEqual([
      [Math.min(unit.minLon, START[0]), Math.min(unit.minLat, START[1])],
      [Math.max(unit.maxLon, -149.99), Math.max(unit.maxLat, 45.001)],
    ])

    // A tap on a quartier under the generator opens nothing.
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-bravo', name: 'Bravo' } }]
    act(() => map.fire('click', { point: { x: 100, y: 100 }, originalEvent: { detail: 1 } }))
    await act(() => new Promise((resolve) => setTimeout(resolve, TAP_OPEN_DELAY_MS + 30)))
    expect(screen.queryByTestId('quartier-sheet')).toBeNull()

    await closeByX()
    await waitFor(() => expect(map.ids().filter((id) => id.startsWith('runomics-route'))).toEqual([]))
    expect(JSON.stringify(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER))).toContain('"sort"')
    // Closed, no sheet either: the tap made while it was open is gone.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByTestId('quartier-sheet')).toBeNull()
  })
})
