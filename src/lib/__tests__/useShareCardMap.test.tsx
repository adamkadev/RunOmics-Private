import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LngLat } from '@/lib/shareCardMap'

/** A MapLibre map that plays out whatever the test scripts for it. */
const maps = vi.hoisted(() => {
  type Handler = (event?: unknown) => void
  class FakeMap {
    static script: (map: FakeMap) => void = () => {}
    static last: FakeMap | null = null
    private handlers = new Map<string, Handler[]>()
    layers: { id: string; source: string }[] = []
    sources = new Map<string, { data: { features: { geometry: { coordinates: number[] } }[] } }>()
    constructor(readonly options: { fitBoundsOptions: { padding: unknown } }) {
      FakeMap.last = this
      setTimeout(() => FakeMap.script(this), 0)
    }
    on(event: string, fn: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn])
    }
    once(event: string, fn: Handler) {
      const wrapped: Handler = (e) => {
        this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== wrapped))
        fn(e)
      }
      this.on(event, wrapped)
    }
    emit(event: string, payload?: unknown) {
      for (const fn of [...(this.handlers.get(event) ?? [])]) fn(payload)
    }
    getCanvas() {
      return Object.assign(document.createElement('canvas'), { width: 900, height: 708 })
    }
    project([x, y]: [number, number]) {
      return { x, y }
    }
    unproject([x, y]: [number, number]) {
      return { lng: x, lat: y }
    }
    getStyle() {
      return { layers: [] }
    }
    hasImage() {
      return false
    }
    addImage() {}
    addSource(id: string, source: { data: never }) {
      this.sources.set(id, source)
    }
    addLayer(layer: { id: string; source: string }) {
      this.layers.push(layer)
    }
    remove() {}
  }
  return { FakeMap }
})

const labelCalls: { halo: string; town: string; neighbourhood: string; districtOpacity?: number }[] = []
const waterCalls: { halo: string; water: string; size?: number; lang?: string }[] = []
vi.mock('@/lib/maplibre', () => ({
  loadMapLibre: async () => ({ Map: maps.FakeMap, LngLatBounds: class { extend() { return this } } }),
  styleRunMapLabels: (_map: unknown, colors: { halo: string; town: string; neighbourhood: string; districtOpacity?: number }) => {
    labelCalls.push(colors)
  },
  addWaterLabels: (_map: unknown, options: { halo: string; water: string; size?: number; lang?: string }) => {
    waterCalls.push(options)
  },
}))
vi.mock('@/lib/runMapLayers', () => ({
  addEdgeFence: () => () => {},
  addRunMarkers: () => {},
  clearMarkerImage: () => ({}),
  setRunFinish: () => {},
}))
vi.mock('@/lib/maptiler', () => ({
  maptilerStyle: () => ({}),
  shareBasemapStyle: (style: unknown) => style,
}))

const { useShareCardMap } = await import('@/lib/useShareCardMap')

const FRAME = { top: 87, right: 14, bottom: 76, left: 14 }

// The hook keeps a drawn map for the session, so each test draws its own route.
const route = (east: number): LngLat[] => [[2.43, 48.89], [east, 48.9]]

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'key')
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// The owner's report, Oct 2026: the card came without its basemap.
describe('the share card basemap', () => {
  it('is drawn though a tile or a font failed to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    maps.FakeMap.script = (map) => {
      map.emit('load')
      map.emit('error', { error: new Error('glyphs 404') })
      map.emit('idle')
    }
    const { result } = renderHook(() => useShareCardMap({ route: route(2.46), theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(result.current.image).not.toBeNull()
    expect(result.current.failed).toBe(false)
    expect(warn).toHaveBeenCalledWith('Share card basemap:', 'glyphs 404')
  })

  // The names sit over a dark map, so they take the muted ink a step more
  // opaque than on light, where the ground is pale.
  it('names the districts in the muted ink, fainter on light than on dark', async () => {
    labelCalls.length = 0
    maps.FakeMap.script = (map) => { map.emit('load'); map.emit('idle') }
    for (const [theme, east, opacity] of [['dark', 2.51, 0.8], ['light', 2.52, 0.7]] as const) {
      renderHook(() => useShareCardMap({ route: route(east), theme, width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
      await act(() => vi.advanceTimersByTimeAsync(100))
      const call = labelCalls.at(-1)!
      expect(call.districtOpacity).toBe(opacity)
      expect(call.neighbourhood).toBe(call.town)
    }
    expect(labelCalls.at(-2)!.town).toBe('#8d9391')
  })

  // The tiles name a river on water_label, not on OpenMapTiles' water_name.
  it('names the rivers in a pale blue-grey, a step smaller than the app draws them', async () => {
    waterCalls.length = 0
    maps.FakeMap.script = (map) => { map.emit('load'); map.emit('idle') }
    renderHook(() => useShareCardMap({ route: route(2.53), theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(waterCalls.at(-1)).toMatchObject({ water: '#5b7d99', size: 10 })
  })

  it('is tried again in the next sheet after one that never settled', async () => {
    maps.FakeMap.script = (map) => map.emit('load')
    const first = renderHook(() => useShareCardMap({ route: route(2.47), theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(15_000))
    expect(first.result.current).toMatchObject({ image: null, failed: true })
    first.unmount()

    maps.FakeMap.script = (map) => { map.emit('load'); map.emit('idle') }
    const next = renderHook(() => useShareCardMap({ route: route(2.47), theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(next.result.current.image).not.toBeNull()
  })

  // Redesign, Oct 2026: the map fills the card, the route fitted between the header and the stats.
  it('fits the route into the card\'s frame, its labels fenced off the route and the bands', async () => {
    maps.FakeMap.script = (map) => { map.emit('load'); map.emit('idle') }
    renderHook(() => useShareCardMap({ route: route(2.48), theme: 'light', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(100))

    const map = maps.FakeMap.last!
    expect(map.options.fitBoundsOptions.padding).toEqual(FRAME)
    expect(map.layers.map((l) => l.id)).toContain('share-label-fence')
    const fence = map.sources.get('share-label-fence')!.data.features.map((f) => f.geometry.coordinates)
    // The route's two ends, and a line across the card at each band.
    expect(fence).toEqual(expect.arrayContaining([[2.43, 48.89], [2.48, 48.9], [0, 79], [300, 79], [0, 307]]))
  })
})
