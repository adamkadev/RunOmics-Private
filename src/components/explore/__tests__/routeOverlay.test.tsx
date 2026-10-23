import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMemo } from 'react'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { AreaCoverage } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import { accentColor } from '@/lib/accent'
import { DISTRICTS_LABEL_LAYERS, DISTRICTS_NEXT_LABEL_LAYER, DISTRICTS_SHAPE_LAYERS } from '../districtsLayer'
import { ROUTE_CASING_LAYER, ROUTE_LAYERS, ROUTE_NEW_LAYER, ROUTE_SOURCE, ROUTE_START_IMAGE, ROUTE_START_LAYER, routeColors, type RouteDrawing } from '../routeLayer'
import { useDistrictsOverlay, useDistrictsSync, type DistrictsOverlayState } from '../useDistrictsOverlay'
import { combineOverlays, useRouteOverlay, useRouteSync } from '../useRouteOverlay'
import type { FakeMap } from './fakeMap'

// The map hook with a fake MapLibre, Districts and the generator's loop as
// one overlay: what is under test is the order they draw in, that both come
// back after a theme or accent swap, and that the loop leaves the map clean.
const maps = vi.hoisted(() => ({ built: [] as FakeMap[] }))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  const { FakeMap } = await import('./fakeMap')
  class RecordedMap extends FakeMap {
    constructor(options: { style?: unknown }) {
      super(options)
      maps.built.push(this)
    }
  }
  return { ...real, loadMapLibre: async () => ({ Map: RecordedMap }) }
})

vi.mock('@/components/map/heatLayer', () => ({
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

const { useMapRoutes } = await import('@/components/map/useMapRoutes')

const AREA = testArea()
const ALPHA = AREA.features[0]!.properties
const COVERAGE: AreaCoverage = {
  areaId: AREA.runomics.id,
  version: AREA.runomics.version,
  units: [
    { id: ALPHA.id, name: ALPHA.name, kind: 'quartier', commune: 'Testville', label: ALPHA.label, visited: 5, total: 100, pct: 5, state: 'fog', kmRun: 1, lastRunDate: null, distanceKm: 1 },
  ],
  exploredPct: 5,
  completeCount: 0,
  unitCount: 1,
  nextId: ALPHA.id,
  home: null,
}
const BOUNDS = { minLon: -150, minLat: 45, maxLon: -149.99, maxLat: 45.01 }
const DATA: MapShellData = {
  routeMeta: [],
  clusters: [{ id: 'c0', routeCount: 0, totalKm: 0, center: [-150, 45], labelPoint: [-150, 45], bounds: BOUNDS, frame: BOUNDS, routeIndices: [] }],
  defaultClusterIdx: 0,
  totalCount: 0,
  totalKm: 0,
  years: [],
}
const NO_ROUTES: [number, number][][] = []
const NO_RUNS: number[] = []
const DRAWING: RouteDrawing = { coordinates: [[-150, 45], [-149.995, 45], [-149.995, 45.005], [-150, 45]], newSteps: [true, false, true], home: [-150.01, 44.99] }

function Harness({ generator, drawing = DRAWING }: { generator: boolean; drawing?: RouteDrawing | null }) {
  const state = useMemo<DistrictsOverlayState>(
    () => ({ area: AREA, coverage: COVERAGE, visible: true, selectedId: null, labelOnly: generator ? ALPHA.id : null }),
    [generator],
  )
  const districts = useDistrictsOverlay(state, true)
  const route = useRouteOverlay(generator ? drawing : null, generator)
  const overlay = useMemo(() => combineOverlays(districts, route), [districts, route])
  const { containerRef, mapRef, mapReady } = useMapRoutes(DATA, NO_ROUTES, 0, NO_RUNS, null, true, { overlay })
  useDistrictsSync(mapRef, mapReady, state)
  useRouteSync(mapRef, mapReady, generator ? drawing : null)
  return <div ref={containerRef} />
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const routeIds = (map: FakeMap) => map.ids().filter((id) => id.startsWith('runomics-route'))

function expectInOrder(map: FakeMap) {
  const ids = map.ids()
  const at = (id: string) => ids.indexOf(id)
  // The loop over the Districts shapes and the home ring and dot, under the base labels.
  expect(at(ROUTE_LAYERS[0])).toBeGreaterThan(at(DISTRICTS_SHAPE_LAYERS.at(-1)!))
  expect(at(ROUTE_LAYERS[0])).toBeGreaterThan(at('home-dot'))
  expect(at(ROUTE_CASING_LAYER)).toBeLessThan(at('Ocean labels'))
  // The start dot over the generator's label, under the fence.
  expect(ids.slice(-2)).toEqual([ROUTE_START_LAYER, 'map-edge-fence'])
  expect(at(ROUTE_START_LAYER)).toBeGreaterThan(at(DISTRICTS_NEXT_LABEL_LAYER))
}

describe('the generator’s loop over the Districts map', () => {
  beforeEach(() => {
    maps.built.length = 0
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-accent')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-accent')
  })

  it('draws the loop over the shapes and under the labels, and names its quartier alone, beside its start', async () => {
    render(<Harness generator />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(routeIds(map)).toHaveLength(ROUTE_LAYERS.length))
    expectInOrder(map)
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(4)
    for (const id of DISTRICTS_LABEL_LAYERS) expect(JSON.stringify(map.getFilter(id))).not.toContain('"sort"')
    expect(JSON.stringify(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER))).toContain(ALPHA.id)
    expect(map.getLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-radial-offset')).toBeGreaterThan(1)
  })

  it('comes back, in order and in the new mode, after a theme swaps the style', async () => {
    render(<Harness generator />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(routeIds(map)).toHaveLength(ROUTE_LAYERS.length))

    document.documentElement.classList.add('dark')
    await tick()
    expect(routeIds(map)).toEqual([])
    map.finish()
    expectInOrder(map)
    expect(map.getLayer(ROUTE_CASING_LAYER)!.paint!['line-color']).toBe(routeColors('dark', 'teal').casing)
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(4)
    expect(JSON.stringify(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER))).toContain(ALPHA.id)
  })

  it('repaints in a new accent, once, still in order', async () => {
    render(<Harness generator />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(routeIds(map)).toHaveLength(ROUTE_LAYERS.length))

    document.documentElement.setAttribute('data-accent', 'violet')
    await tick()
    expectInOrder(map)
    expect(map.getLayer(ROUTE_NEW_LAYER)!.paint!['line-color']).toBe(accentColor('violet', 'light'))
    expect(routeIds(map)).toHaveLength(ROUTE_LAYERS.length)
  })

  it('takes a new loop in place, and leaves the map clean - every quartier named again - when the generator closes', async () => {
    const { rerender } = render(<Harness generator drawing={null} />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(routeIds(map)).toHaveLength(ROUTE_LAYERS.length))
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toEqual([])

    rerender(<Harness generator drawing={DRAWING} />)
    await waitFor(() => expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(4))

    rerender(<Harness generator={false} />)
    await waitFor(() => expect(routeIds(map)).toEqual([]))
    expect(map.hasImage(ROUTE_START_IMAGE)).toBe(false)
    expect([...map.sources.keys()].filter((id) => id.startsWith('runomics-route'))).toEqual([])
    // Districts stays, with every label back.
    expect(JSON.stringify(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER))).toContain('"sort"')
    expect(map.getLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-radial-offset')).toBeLessThan(1)
  })
})
