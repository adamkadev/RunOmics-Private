import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { AreaCoverage, ExploreAreaRef } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import { t } from '@/i18n'
import { MAP_PADDING } from '@/lib/routeFrame'
import { MAP_LAYER_KEY } from '@/components/explore/mapLayer'
import { DISTRICTS_FILL_LAYER, DISTRICTS_SELECTED_LAYER } from '@/components/explore/districtsLayer'
import { ABOVE_SHEET, QUARTIER_MAX_ZOOM, QUARTIER_SIDE, QUARTIER_TOP, unitBounds } from '@/components/explore/quartierCamera'
import { TAP_OPEN_DELAY_MS } from '@/components/explore/useQuartierMap'
import type { FakeMap } from '@/components/explore/__tests__/fakeMap'

// The map page with a fake MapLibre (the heat a plain raster layer) and a
// stand-in coverage engine: what is under test is the path from a tap on a
// quartier to its sheet, the camera move that keeps it in view, and the
// frame the expanded Districts map fits.
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
const DATA: MapShellData = {
  routeMeta: [
    { id: 'run-a', type: 'Base', year: '2026', date: '2026-10-01', distanceKm: 5, durationSeconds: 1800, paceSecPerKm: 360 },
    { id: 'run-b', type: 'Base', year: '2026', date: '2026-10-02', distanceKm: 6, durationSeconds: 2100, paceSecPerKm: 350 },
  ],
  clusters: [{ id: 'c0', routeCount: 2, totalKm: 11, center: [-149.995, 45.005], labelPoint: [-149.995, 45.005], bounds: BOUNDS, frame: BOUNDS, routeIndices: [0, 1] }],
  defaultClusterIdx: 0,
  totalCount: 2,
  totalKm: 11,
  years: ['2026'],
}
const ROUTES = {
  routes: { 0: [[-149.999, 45.001], [-149.998, 45.002]], 1: [[-149.997, 45.001], [-149.996, 45.003]] },
  ids: { 0: 'run-a', 1: 'run-b' },
}

/** The screen the map fills in fullscreen, and where the sheet's panel starts in it (8 pt in from the sides and foot). */
const SCREEN = { top: 0, bottom: 852 }
const SHEET_TOP = 470
const PANEL = { offsetTop: SHEET_TOP, offsetLeft: 8, offsetWidth: 377, offsetHeight: SCREEN.bottom - 8 - SHEET_TOP }

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Past the wait for a second tap: a tap's sheet is open by then. */
const pastTapWait = () => act(() => sleep(TAP_OPEN_DELAY_MS + 30))
const sheet = () => screen.queryByTestId('quartier-sheet')

/** The map page, its map built and its style loaded, with the coverage in. */
async function openMap() {
  render(<GlobalMapClient data={DATA} exploreAreas={[REF]} />)
  await waitFor(() => expect(maps.built).toHaveLength(1))
  const map = maps.built[0]!
  map.container!.getBoundingClientRect = () => ({ ...SCREEN, left: 0, right: 393, width: 393, height: SCREEN.bottom - SCREEN.top, x: 0, y: 0 }) as DOMRect
  act(() => map.finish())
  return map
}

async function districtsReady(map: FakeMap) {
  await waitFor(() => expect(engine.coverage).toHaveBeenCalled())
  await waitFor(() => expect(map.getLayer(DISTRICTS_FILL_LAYER)).toBeDefined())
  await tick()
}

const POINT = { x: 120, y: 300 }
/** A click or tap on the map: the press, then MapLibre's click (`detail` 2 for a double-click's second). */
function click(map: FakeMap, detail = 1) {
  act(() => {
    fireEvent.pointerDown(map.container!)
    map.fire('mousedown', { point: POINT })
    map.fire('click', { point: POINT, originalEvent: { detail } })
  })
}
/** A tap, and the wait for a second that never comes. */
async function tap(map: FakeMap) {
  click(map)
  await pastTapWait()
}
const selected = (map: FakeMap) => JSON.stringify(map.getFilter(DISTRICTS_SELECTED_LAYER))

describe('a quartier’s sheet on the map (S2) and the expanded Districts map (S1)', () => {
  beforeEach(() => {
    maps.built.length = 0
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ROUTES), { status: 200 })))
    engine.loadArea.mockResolvedValue(AREA)
    engine.addTracks.mockResolvedValue({ added: ['run-a', 'run-b'] })
    engine.coverage.mockResolvedValue(COVERAGE)
    localStorage.clear()
    window.history.replaceState(null, '', '/activities?view=map')
    // The sheet's panel sits SHEET_TOP down its dialog layer (jsdom lays nothing out).
    for (const key of Object.keys(PANEL) as (keyof typeof PANEL)[]) {
      vi.spyOn(HTMLElement.prototype, key, 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'quartier-sheet' ? PANEL[key] : 0
      })
    }
  })
  afterEach(async () => {
    cleanup()
    await tick()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('opens the sheet of the quartier tapped, outlines it, and eases it into view above the sheet', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-delta', name: 'Delta' } }]

    await tap(map)

    // Asked of the Districts fill alone, at the point tapped.
    expect(map.renderQueries.at(-1)).toEqual({ point: { x: 120, y: 300 }, options: { layers: [DISTRICTS_FILL_LAYER] } })
    expect(sheet()).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Delta' })).toBeInTheDocument()
    expect(selected(map)).toContain('"test-delta"')

    // The camera: MapLibre's frame for the unit's box in the room the sheet
    // leaves, then a plain move there - no padding left on the map.
    const box = unitBounds(AREA, 'test-delta')!
    expect(map.cameraQueries).toEqual([
      {
        bounds: [
          [box.minLon, box.minLat],
          [box.maxLon, box.maxLat],
        ],
        options: {
          padding: { top: QUARTIER_TOP, right: QUARTIER_SIDE, bottom: SCREEN.bottom - SHEET_TOP + ABOVE_SHEET, left: QUARTIER_SIDE },
          maxZoom: QUARTIER_MAX_ZOOM,
        },
      },
    ])
    expect(map.eases).toHaveLength(1)
    expect(map.eases[0]).toMatchObject({ center: map.camera!.center, zoom: map.camera!.zoom })
    expect(map.eases[0]).not.toHaveProperty('padding')

    // The controls under it are off the map while it is open.
    expect(screen.queryByTestId('layers-button')).toBeNull()
    expect(screen.queryByTestId('map-attribution')).toBeNull()
    expect(screen.queryByTestId('districts-legend')).toBeNull()

    // Closed: the outline goes, the controls come back, the camera stays.
    fireEvent.click(screen.getByRole('button', { name: t.common.close }))
    await waitFor(() => expect(sheet()).toBeNull())
    expect(selected(map)).not.toContain('test-delta')
    expect(screen.getByTestId('layers-button')).toBeInTheDocument()
    expect(map.eases).toHaveLength(1)
  })

  it('listens for taps once per map, through a theme swap', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    expect(map.handlers.get('click')).toHaveLength(1)

    document.documentElement.classList.add('dark')
    await tick()
    act(() => map.finish())
    await tick()
    document.documentElement.classList.remove('dark')
    await tick()
    act(() => map.finish())
    await tick()
    expect(map.handlers.get('click')).toHaveLength(1)
    expect(map.handlers.get('mousemove')).toHaveLength(1)

    // And the tap still finds the layer drawn on the new style.
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-bravo' } }]
    await tap(map)
    expect(screen.getByRole('dialog', { name: 'Bravo' })).toBeInTheDocument()
  })

  it('waits out a double-click or double-tap, which zooms the map and opens nothing', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-bravo' } }]

    // A mouse: click, click (detail 2), dblclick. No scrim went up under the
    // second click, so it reached the map.
    click(map)
    expect(sheet()).toBeNull()
    click(map, 2)
    act(() => map.fire('dblclick', { point: POINT }))
    await pastTapWait()
    expect(sheet()).toBeNull()

    // A finger: the second tap's touchstart, then the zoom (MapLibre sends no click for it).
    click(map)
    act(() => {
      map.fire('touchstart', { point: POINT })
      map.fire('zoomstart')
    })
    await pastTapWait()
    expect(sheet()).toBeNull()

    // One tap alone opens it, once the wait is over.
    click(map)
    expect(sheet()).toBeNull()
    await pastTapWait()
    expect(screen.getByRole('dialog', { name: 'Bravo' })).toBeInTheDocument()
  })

  it('a tap that closes a popover over the map closes it alone, as in Heat', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-bravo' } }]

    fireEvent.click(screen.getByRole('button', { name: t.pages.map.credits }))
    expect(screen.getByRole('note')).toBeInTheDocument()
    await tap(map)
    expect(screen.queryByRole('note')).toBeNull()
    expect(sheet()).toBeNull()
    expect(map.eases).toEqual([])

    // Nothing open over the map: the next tap opens the quartier.
    await tap(map)
    expect(screen.getByRole('dialog', { name: 'Bravo' })).toBeInTheDocument()
  })

  it('points at a quartier with a mouse, and nowhere else', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-bravo' } }]
    map.fire('mousemove', { point: { x: 10, y: 10 } })
    expect(map.canvas.style.cursor).toBe('pointer')
    map.drawn = []
    map.fire('mousemove', { point: { x: 10, y: 10 } })
    expect(map.canvas.style.cursor).toBe('')
  })

  it('does nothing on a tap in Heat: no Districts layer to find', async () => {
    const map = await openMap()
    await tick()
    map.drawn = [{ layer: DISTRICTS_FILL_LAYER, properties: { id: 'test-bravo' } }]
    await tap(map)
    expect(sheet()).toBeNull()
    expect(map.renderQueries).toEqual([])
  })

  it('expanded, fits every quartier of the area clear of its foot; the heat keeps its own frame', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    const [minLon, minLat, maxLon, maxLat] = REF.bbox
    const areaFit = { bounds: [[minLon, minLat], [maxLon, maxLat]], padding: MAP_PADDING.districtsFullscreen }

    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    await waitFor(() => expect(map.fits.at(-1)?.options.padding).toEqual(MAP_PADDING.districtsFullscreen))
    expect({ bounds: map.fits.at(-1)!.bounds, padding: map.fits.at(-1)!.options.padding }).toEqual(areaFit)

    // To the heat, still expanded: its frame and its fullscreen padding, as before Explore.
    fireEvent.click(screen.getByTestId('layers-button'))
    await waitFor(() => expect(map.fits.at(-1)?.options.padding).toEqual(MAP_PADDING.fullscreen))
    expect(map.fits.at(-1)!.bounds).not.toEqual(areaFit.bounds)

    // Back to the map card in Districts: the heat's frame in the card.
    fireEvent.click(screen.getByTestId('layers-button'))
    await waitFor(() => expect(map.fits.at(-1)?.options.padding).toEqual(MAP_PADDING.districtsFullscreen))
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.exitFullscreen }))
    await waitFor(() => expect(map.fits.at(-1)?.options.padding).toEqual(MAP_PADDING.card))
  })

  it('in the expanded map, opens the next quartier’s sheet from its card, and frames it above the sheet', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    fireEvent.click(await screen.findByTestId('next-quartier-card'))

    expect(screen.getByRole('dialog', { name: 'Bravo' })).toBeInTheDocument()
    expect(selected(map)).toContain('"test-bravo"')
    expect(map.cameraQueries.at(-1)?.options.padding).toMatchObject({ bottom: SCREEN.bottom - SHEET_TOP + ABOVE_SHEET })
    expect(screen.queryByTestId('next-quartier-card')).toBeNull()
  })

  it('gives focus back to the next quartier’s card when the sheet it opened closes', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    const card = await screen.findByTestId('next-quartier-card')
    card.focus()
    fireEvent.click(card)
    expect(screen.getByRole('dialog', { name: 'Bravo' })).toBeInTheDocument()

    // Escape closes the sheet alone; the card is back, a new one, focused.
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(sheet()).toBeNull())
    expect(document.activeElement).toBe(screen.getByTestId('next-quartier-card'))
    expect(screen.getByRole('button', { name: t.pages.map.exitFullscreen })).toBeInTheDocument()
  })

  it('takes the controls off the map under the filters’ sheet in Districts; the heat keeps its own', async () => {
    localStorage.setItem(MAP_LAYER_KEY, 'districts')
    const map = await openMap()
    await districtsReady(map)
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.fullscreen }))
    await screen.findByTestId('next-quartier-card')
    const controls = ['next-quartier-card', 'layers-button', 'map-attribution', 'districts-legend']

    fireEvent.click(screen.getByRole('button', { name: t.pages.map.filters.button }))
    expect(screen.getByTestId('heat-filter-sheet')).toBeInTheDocument()
    for (const id of controls) expect(screen.queryByTestId(id), id).toBeNull()
    fireEvent.click(within(screen.getByTestId('heat-filter-sheet')).getByRole('button', { name: t.common.close }))
    await waitFor(() => expect(screen.queryByTestId('heat-filter-sheet')).toBeNull())
    for (const id of controls) expect(screen.getByTestId(id), id).toBeInTheDocument()

    // In the heat, as before Explore: the sheet over them, the controls kept.
    fireEvent.click(screen.getByTestId('layers-button'))
    fireEvent.click(screen.getByRole('button', { name: t.pages.map.filters.button }))
    expect(screen.getByTestId('heat-filter-sheet')).toBeInTheDocument()
    expect(screen.getByTestId('layers-button')).toBeInTheDocument()
    expect(screen.getByTestId('map-attribution')).toBeInTheDocument()
  })
})
