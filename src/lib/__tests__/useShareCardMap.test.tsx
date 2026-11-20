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
    static scale = 1
    project([x, y]: [number, number]) {
      return { x: x * FakeMap.scale, y: y * FakeMap.scale }
    }
    unproject([x, y]: [number, number]) {
      return { lng: x / FakeMap.scale, lat: y / FakeMap.scale }
    }
    styleLayers: { id: string; type: string; 'source-layer'?: string; source?: string }[] = []
    rendered: unknown[] = []
    sourceFeatures: Record<string, unknown[]> = {}
    filters = new Map<string, unknown>()
    querySourceFeatures(_source: string, { sourceLayer }: { sourceLayer: string }) {
      return this.sourceFeatures[sourceLayer] ?? []
    }
    getLayer(id: string) {
      return this.layers.find((l) => l.id === id)
    }
    getFilter(id: string) {
      return this.filters.get(id)
    }
    setFilter(id: string, filter: unknown) {
      this.filters.set(id, filter)
    }
    hidden: string[] = []
    moved: string[] = []
    getStyle() {
      return { layers: this.styleLayers }
    }
    moveLayer(id: string) {
      this.moved.push(id)
    }
    queryRenderedFeatures() {
      return this.rendered
    }
    getLayoutProperty() {
      return 9
    }
    getPaintProperty() {
      return 0.8
    }
    setLayoutProperty(id: string, key: string, value: string) {
      if (key === 'visibility' && value === 'none') this.hidden.push(id)
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
const parkCalls: { halo: string; park: string; size?: number; lang?: string }[] = []
const landmarkCalls: { halo: string; landmark: string; size?: number; lang?: string }[] = []
vi.mock('@/lib/maplibre', () => ({
  loadMapLibre: async () => ({ Map: maps.FakeMap, LngLatBounds: class { extend() { return this } } }),
  styleRunMapLabels: (_map: unknown, colors: { halo: string; town: string; neighbourhood: string; districtOpacity?: number }) => {
    labelCalls.push(colors)
  },
  addWaterLabels: (_map: unknown, options: { halo: string; water: string; size?: number; lang?: string }) => {
    waterCalls.push(options)
  },
  addParkLabels: (_map: unknown, options: { halo: string; park: string; size?: number; lang?: string }) => {
    parkCalls.push(options)
  },
  addLandmarkLabels: (_map: unknown, options: { halo: string; landmark: string; size?: number; lang?: string }) => {
    landmarkCalls.push(options)
  },
  showPlacesAtAnyZoom: () => {},
  PARK_LABEL_LAYER: 'runomics-park-label',
  WATER_LABEL_LAYER: 'runomics-water-label',
  isPlaceLabelLayer: (layer: { 'source-layer'?: string }) => layer['source-layer'] === 'place_label',
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
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [] }) })))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

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

  // Over a dark map the names need the muted ink a step more opaque than on a pale one.
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
  it('names the rivers, parks and landmarks, a step smaller than the app draws them', async () => {
    waterCalls.length = 0
    parkCalls.length = 0
    landmarkCalls.length = 0
    maps.FakeMap.script = (map) => { map.emit('load'); map.emit('idle') }
    renderHook(() => useShareCardMap({ route: route(2.53), theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(waterCalls.at(-1)).toMatchObject({ water: '#5b7d99', size: 10 })
    expect(parkCalls.at(-1)).toMatchObject({ park: '#5f8a6d', size: 10 })
    expect(landmarkCalls.at(-1)).toMatchObject({ landmark: '#a3a9a7', size: 10 })
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

describe('the share card names', () => {
  /** Px a degree at the equator, so a px is about 10 m. */
  const K = 11132
  const at = (x: number, y: number): LngLat => [x / K, y / K]
  const point = (name: string, x: number, y: number, props: Record<string, unknown> = {}) =>
    ({ properties: { name, ...props }, geometry: { type: 'Point', coordinates: at(x, y) } })
  const square = (x0: number, y0: number, x1: number, y1: number) =>
    ({ properties: {}, geometry: { type: 'Polygon', coordinates: [[at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)]] }, layer: { id: 'Wood' } })
  const loop = (x0: number, y0: number, x1: number, y1: number, n = 10): LngLat[] => {
    const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
    return corners.slice(1).flatMap(([x, y], c) => Array.from({ length: n }, (_, i) => {
      const [px, py] = corners[c]!
      return at(px + ((x - px) * (i + 1)) / n, py + ((y - py) * (i + 1)) / n)
    })).concat([at(x0, y0)]).slice(-41).reverse().concat([at(x0, y0)]).reverse()
  }
  const styleLayers = [
    { id: 'Wood', type: 'fill', 'source-layer': 'wood', source: 'maptiler' },
    { id: 'Place labels', type: 'symbol', 'source-layer': 'place_label', source: 'maptiler' },
  ]
  type Fake = { styleLayers: unknown[]; rendered: unknown[]; sourceFeatures: Record<string, unknown[]>; filters: Map<string, unknown>; hidden: string[]; layers: { id: string; source: string }[] }

  function geocoder(answer: (url: string) => unknown[] = () => []) {
    const fetchMock = vi.fn<(url: string) => Promise<unknown>>((url) => Promise.resolve({ ok: true, json: () => Promise.resolve({ features: answer(url) }) }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  async function draw(route: LngLat[], setup: (fake: Fake) => void) {
    let drawn: Fake | null = null
    maps.FakeMap.scale = K
    maps.FakeMap.script = (map) => {
      const fake = map as unknown as Fake
      fake.styleLayers = styleLayers
      setup(fake)
      drawn = fake
      map.emit('load')
      const again = (n: number) => { map.emit('idle'); if (n > 0) setTimeout(() => again(n - 1), 10) }
      again(50)
    }
    const { result } = renderHook(() => useShareCardMap({ route, theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    return { labels: result.current.labels ?? [], map: drawn! }
  }

  afterEach(() => {
    maps.FakeMap.scale = 1
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('names a forest loop\'s start and one more place though the geocoder answers nothing', async () => {
    geocoder()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { labels, map } = await draw(loop(100, 100, 200, 250), (fake) => {
      fake.rendered = [square(90, 90, 210, 260)]
      fake.sourceFeatures = { place_label: [point('Les Prés', 104, 96, { class: 'neighbourhood' }), point('Nordville', 230, 180, { class: 'suburb' })] }
    })
    expect(labels.length).toBeGreaterThanOrEqual(2)
    expect(labels.find((l) => l.kind === 'start')).toMatchObject({ text: 'Les Prés', x: 100, y: 100 })
    expect(labels.map((l) => l.text)).toContain('Nordville')
    expect(map.hidden).toContain('Place labels')
  })

  it('labels the start with its quarter, not the town it is in, the town at most a second name', async () => {
    geocoder()
    const { labels } = await draw(loop(300, 300, 400, 420), (fake) => {
      fake.sourceFeatures = {
        place_label: [point('Les Prés', 305, 295, { class: 'neighbourhood' })],
        town_label: [point('Grandville', 310, 310)],
      }
    })
    expect(labels.filter((l) => l.kind === 'start').map((l) => l.text)).toEqual(['Les Prés'])
  })

  it('takes the geocoder\'s quarter at the start when the tiles name none near it', async () => {
    geocoder((url) => (url.includes('types=') ? [] : [
      { text: 'Quartier des Lilas', place_type: ['locality'], center: at(520, 520) },
      { text: 'Grandville', place_type: ['municipality'], center: at(700, 700) },
    ]))
    const { labels } = await draw(loop(500, 500, 600, 640), (fake) => {
      fake.sourceFeatures = { town_label: [point('Grandville', 700, 700)] }
    })
    expect(labels.find((l) => l.kind === 'start')?.text).toBe('Quartier des Lilas')
  })

  it('gives the subtitle the town the geocoder puts the start in, from the start label\'s own lookup', async () => {
    const fetchMock = geocoder((url) => (url.includes('types=') ? [] : [
      { text: 'Quartier des Lilas', place_type: ['locality'], center: at(2520, 2520) },
      { text: 'Grandville', place_type: ['municipality'], center: at(2700, 2700) },
    ]))
    maps.FakeMap.scale = K
    maps.FakeMap.script = (map) => {
      ;(map as unknown as Fake).styleLayers = styleLayers
      map.emit('load')
      const again = (n: number) => { map.emit('idle'); if (n > 0) setTimeout(() => again(n - 1), 10) }
      again(50)
    }
    const hook = renderHook(() => useShareCardMap({ route: loop(2500, 2500, 2600, 2640), theme: 'dark', width: 300, height: 375, frame: FRAME, bands: [79, 307] }))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.result.current.place).toBe('Grandville')
    expect(fetchMock.mock.calls.some(([url]) => /geocoding\/0\.225,0\.225\.json/.test(String(url)))).toBe(true)
  })

  it('names the finish\'s area when it is another, but one place only once', async () => {
    geocoder()
    const route = [at(900, 900), at(950, 900), at(1000, 900), at(1050, 900), at(1100, 900)]
    const { labels } = await draw(route, (fake) => {
      fake.sourceFeatures = { place_label: [
        point('Les Prés', 902, 898, { class: 'neighbourhood' }),
        point('Le Moulin', 1098, 902, { class: 'neighbourhood' }),
      ] }
    })
    expect(labels.filter((l) => l.kind === 'start' || l.kind === 'finish').map((l) => [l.kind, l.text])).toEqual([['start', 'Les Prés'], ['finish', 'Le Moulin']])
    expect(labels.filter((l) => l.text === 'Le Moulin')).toHaveLength(1)
  })

  it('names the green by the geocoder at its centre, then at points inside it, then by a landform there', async () => {
    const calls: string[] = []
    geocoder((url) => {
      if (url.includes('/cathedral.json')) return []
      calls.push(url.includes('types=poi') ? 'poi' : 'areas')
      return url.includes('types=poi') ? [] : [{ text: 'Forêt des Hêtres', place_type: ['major_landform'], properties: { categories: ['forest'] }, center: at(0, 0) }]
    })
    const { labels } = await draw(loop(1300, 1300, 1400, 1450), (fake) => {
      fake.rendered = [square(1290, 1290, 1410, 1460)]
    })
    expect(labels.find((l) => l.kind === 'landmark')?.text).toBe('Forêt des Hêtres')
    const landmarkCalls = calls.slice(1)
    expect(landmarkCalls.slice(0, 3)).toEqual(['poi', 'poi', 'areas'])
  })

  it('names a reserve called after a quarter by its short name, and still names that quarter', async () => {
    geocoder((url) => (url.includes('types=') ? [] : [
      { text: 'Réserve naturelle nationale du massif forestier des Prés et de la Combe', place_type: ['major_landform'], properties: { categories: ['protected area', 'nature reserve'] }, center: at(0, 0) },
    ]))
    const { labels } = await draw(loop(2900, 2900, 3000, 3050), (fake) => {
      fake.rendered = [square(2890, 2890, 3010, 3060)]
      fake.sourceFeatures = { place_label: [point('Le Moulin', 2902, 2898, { class: 'neighbourhood' }), point('Les Prés', 2960, 3040, { class: 'suburb' })] }
    })
    expect(labels.find((l) => l.kind === 'landmark')?.text).toBe('Massif forestier des Prés')
    expect(labels.map((l) => l.text)).toEqual(expect.arrayContaining(['Le Moulin', 'Les Prés']))
  })

  it('falls back to the locality the route spends the most distance in when nothing names the green', async () => {
    geocoder()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { labels } = await draw(loop(1700, 1700, 1800, 1850), (fake) => {
      fake.rendered = [square(1690, 1690, 1810, 1860)]
      fake.sourceFeatures = { place_label: [point('Le Bois-Joli', 1760, 1780, { class: 'suburb' })] }
    })
    expect(labels).toContainEqual(expect.objectContaining({ text: 'Le Bois-Joli', priority: 4 }))
  })

  it('names the park from the tiles when the geocoder names none, and keeps the map from drawing it too', async () => {
    geocoder()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { labels, map } = await draw(loop(2100, 2100, 2200, 2250), (fake) => {
      fake.styleLayers = [...styleLayers, { id: 'POI', type: 'symbol', 'source-layer': 'poi_public', source: 'maptiler' }]
      fake.rendered = [square(2090, 2090, 2210, 2260)]
      fake.sourceFeatures = { poi_public: [point('Parc des Tilleuls', 2150, 2170, { subclass: 'park' })] }
      fake.layers.push({ id: 'runomics-park-label', source: 'maptiler' })
    })
    expect(labels).toContainEqual(expect.objectContaining({ text: 'Parc des Tilleuls', kind: 'landmark', priority: 4, color: '#5f8a6d' }))
    expect(JSON.stringify(map.filters.get('runomics-park-label'))).toContain('Parc des Tilleuls')
  })
})

describe('mapPixelRatio', () => {
  it('draws a portrait map at the 1080 px export width, a story one no larger than the size known to draw on a phone', async () => {
    const { mapPixelRatio } = await import('@/lib/useShareCardMap')
    expect(mapPixelRatio(300, 375) * 300).toBeCloseTo(1080)
    const story = mapPixelRatio(300, (300 * 16) / 9)
    expect(story).toBeGreaterThanOrEqual(3)
    expect(story).toBeLessThan(3.1)
  })
})
