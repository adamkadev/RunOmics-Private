import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import type { AreaCoverage } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import { accentColor } from '@/lib/accent'
import {
  DISTRICTS_CHECK_IMAGE,
  DISTRICTS_LABEL_LAYER,
  DISTRICTS_LINE_LAYER,
  DISTRICTS_SHAPE_LAYERS,
  districtsColors,
} from '@/components/explore/districtsLayer'
import { useDistrictsOverlay, useDistrictsSync, type DistrictsOverlayState } from '@/components/explore/useDistrictsOverlay'
import { baseLayers, type FakeMap } from '@/components/explore/__tests__/fakeMap'

// The map hook with a fake MapLibre: the heat is a plain raster layer, so
// what is under test is the order the overlay is drawn in, and that it
// comes back after a theme or accent swap.
const maps = vi.hoisted(() => ({ built: [] as FakeMap[] }))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  const { FakeMap } = await import('@/components/explore/__tests__/fakeMap')
  class RecordedMap extends FakeMap {
    constructor(options: { style?: unknown }) {
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

const { useMapRoutes } = await import('../useMapRoutes')

const AREA = testArea()
const COVERAGE: AreaCoverage = {
  areaId: AREA.runomics.id,
  version: AREA.runomics.version,
  units: [
    {
      id: 'test-alpha', name: 'Alpha', kind: 'quartier', commune: 'Testville', label: AREA.features[0]!.properties.label,
      visited: 95, total: 100, pct: 95, state: 'complete', kmRun: 3, lastRunDate: '2026-10-01', distanceKm: 0.5,
    },
  ],
  exploredPct: 95,
  completeCount: 1,
  unitCount: 1,
  nextId: null,
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
const STATE: DistrictsOverlayState = { area: AREA, coverage: COVERAGE, visible: true, selectedId: null }

function Harness({ districts }: { districts: boolean }) {
  const overlay = useDistrictsOverlay(STATE, districts)
  const { containerRef, mapRef, mapReady } = useMapRoutes(DATA, NO_ROUTES, 0, NO_RUNS, null, false, { overlay })
  useDistrictsSync(mapRef, mapReady, STATE)
  return <div ref={containerRef} />
}

/** The observer runs after a microtask. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const ours = (map: FakeMap) => map.ids().filter((id) => id.startsWith('runomics-districts'))
const RUN_ORDER = ['heat', ...DISTRICTS_SHAPE_LAYERS, 'home-ring', 'home-dot']

function expectDrawnInOrder(map: FakeMap) {
  const ids = map.ids()
  const at = (id: string) => ids.indexOf(id)
  for (let k = 1; k < RUN_ORDER.length; k++) expect(at(RUN_ORDER[k]!), RUN_ORDER[k]).toBe(at(RUN_ORDER[k - 1]!) + 1)
  // The labels over the base quartier names and under the town names (so
  // "Metz" keeps its place), all under the fence that drops the cut ones.
  expect(ids.slice(-3)).toEqual([DISTRICTS_LABEL_LAYER, 'Town labels', 'map-edge-fence'])
  expect(at(DISTRICTS_LABEL_LAYER)).toBe(at('Place labels') + 1)
  expect(map.hasImage(DISTRICTS_CHECK_IMAGE)).toBe(true)
}

describe('the Districts overlay on the heat map', () => {
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

  it('leaves the heat map exactly as it was while Districts is off', async () => {
    render(<Harness districts={false} />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await tick()
    expect(ours(map)).toEqual([])
    expect(map.ids()).toEqual(['Background', 'Road network', 'heat', 'home-ring', 'home-dot', 'Ocean labels', 'Place labels', 'Town labels', 'map-edge-fence'])
    expect(map.getFilter('Place labels')).toEqual(baseLayers().find((l) => l.id === 'Place labels')!.filter)
  })

  it('draws over the heat, under the ring and dot, with its labels on top', async () => {
    render(<Harness districts />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(ours(map).length).toBeGreaterThan(0))
    expectDrawnInOrder(map)
    expect(JSON.stringify(map.getFilter('Place labels'))).toContain('"alpha"')
    expect(JSON.stringify(map.getLayer(DISTRICTS_LINE_LAYER)!.paint)).toContain(accentColor('teal', 'light'))
  })

  it('comes back, in order and in the new mode, after a theme swaps the style', async () => {
    render(<Harness districts />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(ours(map).length).toBeGreaterThan(0))

    document.documentElement.classList.add('dark')
    await tick()
    // setStyle wiped everything; nothing is drawn until the style loads.
    expect(map.styles).toHaveLength(2)
    expect(ours(map)).toEqual([])
    map.finish()
    expectDrawnInOrder(map)
    expect(JSON.stringify(map.getLayer(DISTRICTS_LABEL_LAYER)!.paint)).toContain(districtsColors('dark', 'teal').label.halo)
    expect(JSON.stringify(map.getFilter('Place labels'))).toContain('"alpha"')
  })

  it('repaints in a new accent, still in order', async () => {
    render(<Harness districts />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await waitFor(() => expect(ours(map).length).toBeGreaterThan(0))

    document.documentElement.setAttribute('data-accent', 'violet')
    await tick()
    expectDrawnInOrder(map)
    expect(JSON.stringify(map.getLayer(DISTRICTS_LINE_LAYER)!.paint)).toContain(accentColor('violet', 'light'))
    expect(map.ids().filter((id) => id === DISTRICTS_LINE_LAYER)).toHaveLength(1)
  })

  it('arrives on a map already drawn, and leaves it clean when switched off', async () => {
    const { rerender } = render(<Harness districts={false} />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()
    await tick()
    const heatOnly = map.getStyle().layers

    rerender(<Harness districts />)
    await waitFor(() => expect(ours(map).length).toBeGreaterThan(0))
    expectDrawnInOrder(map)

    rerender(<Harness districts={false} />)
    await waitFor(() => expect(ours(map)).toEqual([]))
    expect(map.getStyle().layers).toEqual(heatOnly)
    expect(map.hasImage(DISTRICTS_CHECK_IMAGE)).toBe(false)
    expect([...map.sources.keys()].filter((id) => id.startsWith('runomics'))).toEqual([])
  })
})
