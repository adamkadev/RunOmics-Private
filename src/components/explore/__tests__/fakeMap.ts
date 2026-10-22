/**
 * Just enough of a MapLibre map for the Districts layer and the map hook:
 * an ordered layer list with `beforeId` insertion, sources with `setData`,
 * images, filters and layout properties, events, and a `setStyle` that wipes
 * everything back to the base style until `finish()` fires `style.load`.
 * Like MapLibre, it throws on a duplicate id or on removing a source a layer
 * still uses, so a wrong order fails the test.
 */

export interface FakeLayer {
  id: string
  type: string
  source?: string
  'source-layer'?: string
  filter?: unknown
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
}

/** A slice of the RunOmics style: grounds, then labels (the place ones filtered as the real style does). */
export function baseLayers(): FakeLayer[] {
  return [
    { id: 'Background', type: 'background' },
    { id: 'Road network', type: 'line', source: 'maptiler_planet_v4', 'source-layer': 'road' },
    { id: 'Ocean labels', type: 'symbol', source: 'maptiler_planet_v4', 'source-layer': 'water_centroid', layout: { 'text-field': ['get', 'name'] } },
    {
      id: 'Place labels',
      type: 'symbol',
      source: 'maptiler_planet_v4',
      'source-layer': 'place_label',
      filter: ['all', ['match', ['get', 'class'], ['quarter', 'suburb'], true, false], ['==', ['geometry-type'], 'Point']],
      layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] },
    },
    {
      id: 'Town labels',
      type: 'symbol',
      source: 'maptiler_planet_v4',
      'source-layer': 'town_label',
      layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] },
    },
  ]
}

interface FakeSource {
  spec: Record<string, unknown>
  data: unknown
  setData(data: unknown): void
}

export class FakeMap {
  layers: FakeLayer[] = baseLayers()
  sources = new Map<string, FakeSource>()
  images = new Map<string, { image: { width: number; height: number; data: Uint8Array }; options?: unknown }>()
  handlers = new Map<string, ((event?: unknown) => void)[]>()
  styles: unknown[] = []
  loaded = false
  removed = false
  container = typeof document === 'undefined' ? null : document.createElement('div')
  touchZoomRotate = { disableRotation() {} }
  keyboard = { disableRotation() {} }

  constructor(options?: { style?: unknown }) {
    if (options?.style) this.styles.push(options.style)
  }

  // --- style ---------------------------------------------------------------
  getStyle() {
    return { layers: this.layers.map((layer) => ({ ...layer })) }
  }
  setStyle(style: unknown) {
    this.styles.push(style)
    this.loaded = false
    this.layers = baseLayers()
    this.sources.clear()
    this.images.clear()
  }
  /** The style has loaded: style.load fires. */
  finish() {
    this.loaded = true
    this.fire('style.load')
  }
  isStyleLoaded() {
    return this.loaded
  }

  // --- layers --------------------------------------------------------------
  ids(): string[] {
    return this.layers.map((layer) => layer.id)
  }
  addLayer(layer: FakeLayer, beforeId?: string) {
    if (this.getLayer(layer.id)) throw new Error(`Layer "${layer.id}" already exists`)
    if (layer.source && !this.sources.has(layer.source) && !this.isBaseSource(layer.source)) throw new Error(`Source "${layer.source}" not found`)
    const copy = JSON.parse(JSON.stringify(layer)) as FakeLayer
    const at = beforeId ? this.layers.findIndex((l) => l.id === beforeId) : -1
    if (at === -1) this.layers.push(copy)
    else this.layers.splice(at, 0, copy)
  }
  private isBaseSource(id: string) {
    return id === 'maptiler_planet_v4'
  }
  getLayer(id: string) {
    return this.layers.find((layer) => layer.id === id)
  }
  removeLayer(id: string) {
    if (!this.getLayer(id)) throw new Error(`Layer "${id}" not found`)
    this.layers = this.layers.filter((layer) => layer.id !== id)
  }
  getFilter(id: string) {
    const filter = this.getLayer(id)?.filter
    return filter === undefined ? undefined : JSON.parse(JSON.stringify(filter))
  }
  setFilter(id: string, filter: unknown) {
    const layer = this.getLayer(id)
    if (!layer) throw new Error(`Layer "${id}" not found`)
    if (filter === null || filter === undefined) delete layer.filter
    else layer.filter = JSON.parse(JSON.stringify(filter))
  }
  getLayoutProperty(id: string, name: string) {
    return this.getLayer(id)?.layout?.[name]
  }
  setLayoutProperty(id: string, name: string, value: unknown) {
    const layer = this.getLayer(id)
    if (!layer) throw new Error(`Layer "${id}" not found`)
    layer.layout = { ...(layer.layout ?? {}), [name]: value }
  }
  setPaintProperty(id: string, name: string, value: unknown) {
    const layer = this.getLayer(id)
    if (!layer) return
    layer.paint = { ...(layer.paint ?? {}), [name]: value }
  }
  setLayerZoomRange() {}

  // --- sources -------------------------------------------------------------
  addSource(id: string, spec: Record<string, unknown>) {
    if (this.sources.has(id)) throw new Error(`Source "${id}" already exists`)
    const source: FakeSource = {
      spec,
      data: spec.data,
      setData(data: unknown) {
        source.data = data
      },
    }
    // A canvas source (the heat) answers the calls the heat layer makes.
    Object.assign(source, { play() {}, pause() {}, setCoordinates() {} })
    this.sources.set(id, source)
  }
  getSource(id: string) {
    return this.sources.get(id)
  }
  removeSource(id: string) {
    if (!this.sources.has(id)) throw new Error(`Source "${id}" not found`)
    const user = this.layers.find((layer) => layer.source === id)
    if (user) throw new Error(`Source "${id}" cannot be removed while layer "${user.id}" is using it`)
    this.sources.delete(id)
  }

  // --- images --------------------------------------------------------------
  addImage(id: string, image: { width: number; height: number; data: Uint8Array }, options?: unknown) {
    if (this.images.has(id)) throw new Error(`An image named "${id}" already exists`)
    this.images.set(id, { image, options })
  }
  hasImage(id: string) {
    return this.images.has(id)
  }
  removeImage(id: string) {
    this.images.delete(id)
  }
  updateImage(id: string, image: { width: number; height: number; data: Uint8Array }) {
    this.images.set(id, { image, options: this.images.get(id)?.options })
  }

  // --- events and camera ---------------------------------------------------
  on(event: string, cb: (event?: unknown) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb])
    return this
  }
  off(event: string, cb: (event?: unknown) => void) {
    this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== cb))
    return this
  }
  once(event: string, cb: (event?: unknown) => void) {
    const wrapped = (e?: unknown) => {
      this.off(event, wrapped)
      cb(e)
    }
    return this.on(event, wrapped)
  }
  fire(event: string, payload?: unknown) {
    for (const cb of [...(this.handlers.get(event) ?? [])]) cb(payload)
  }
  getContainer() {
    return this.container
  }
  getCanvas() {
    return { clientWidth: 320, clientHeight: 320 }
  }
  unproject() {
    return { lng: 0, lat: 0 }
  }
  project() {
    return { x: 0, y: 0 }
  }
  resize() {}
  fitBounds() {}
  remove() {
    this.removed = true
  }
}
