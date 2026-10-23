import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => ({
  layers: [] as { id: string; type: string; paint?: Record<string, unknown> }[],
  markers: 0,
  before: [] as (string | undefined)[],
  controls: [] as unknown[],
  styles: 0,
}))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  class FakeMap {
    layers: { id: string; type: string }[] = [{ id: 'Town labels', type: 'symbol' }]
    sources = new Set<string>()
    handlers: (() => void)[] = []
    constructor() { seen.layers = this.layers; seen.styles = 1 }
    addControl(control: unknown) { seen.controls.push(control) }
    once() {}
    on(event: string, cb: () => void) {
      if (event !== 'style.load') return
      this.handlers.push(cb)
      queueMicrotask(cb)
    }
    isStyleLoaded() { return true }
    // A new style wipes every layer and source, then fires style.load.
    setStyle() {
      seen.styles += 1
      this.layers.splice(0, this.layers.length, { id: 'Town labels', type: 'symbol' })
      this.sources.clear()
      for (const cb of this.handlers) queueMicrotask(cb)
    }
    off() {}
    remove() {}
    resize() {}
    fitBounds() {}
    getStyle() { return { layers: this.layers } }
    setLayoutProperty() {}
    setPaintProperty() {}
    setLayerZoomRange() {}
    getFilter() { return undefined }
    setFilter() {}
    addSource(id: string) { this.sources.add(id) }
    getSource(id: string) { return this.sources.has(id) ? { setData() {} } : undefined }
    getLayer(id: string) { return this.layers.find((l) => l.id === id) }
    addLayer(layer: { id: string; type: string }, before?: string) {
      seen.before.push(before)
      const at = before ? this.layers.findIndex((l) => l.id === before) : this.layers.length
      this.layers.splice(at, 0, layer)
    }
    hasImage() { return false }
    addImage() {}
    updateImage() {}
    project() { return { x: 0, y: 0 } }
    getCanvas() { return { clientWidth: 100, clientHeight: 100 } }
    unproject() { return { lng: 0, lat: 0 } }
  }
  class FakeBounds { extend() { return this } }
  class FakeMarker { constructor() { seen.markers += 1 } setLngLat() { return this } addTo() { return this } remove() {} }
  return {
    ...real,
    loadMapLibre: async () => ({
      Map: FakeMap,
      LngLatBounds: FakeBounds,
      AttributionControl: class { options: unknown; constructor(options: unknown) { this.options = options } },
      Marker: FakeMarker,
    }),
  }
})

const { default: ActivityMap } = await import('../ActivityMap')

describe('ActivityMap layers (v4.17)', () => {
  it('swaps the style in place on a theme change and brings the run back', async () => {
    render(<ActivityMap route={[[7.7, 48.6], [7.72, 48.62]]} />)
    await waitFor(() => expect(seen.layers.some((l) => l.id === 'run-cursor')).toBe(true))
    document.documentElement.classList.toggle('dark')
    await waitFor(() => expect(seen.styles).toBe(2))
    await waitFor(() => expect(seen.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['route-line', 'run-finish-mark', 'run-start-dot', 'run-cursor'])))
    document.documentElement.classList.toggle('dark')
  })

  beforeAll(() => { process.env.NEXT_PUBLIC_MAPTILER_TOKEN = 'test' })

  it('draws the route in the accent under the place names, the start and the scrub marker as circle layers, no DOM markers', async () => {
    render(<ActivityMap route={[[7.7, 48.6], [7.72, 48.62]]} />)
    await waitFor(() => expect(seen.layers.some((l) => l.id === 'run-cursor')).toBe(true))
    const ids = seen.layers.map((l) => l.id)
    expect(ids.indexOf('route-line')).toBeLessThan(ids.indexOf('Town labels'))
    expect(ids).not.toContain('route-bg')
    expect(ids.indexOf('run-start-dot')).toBeGreaterThan(ids.indexOf('Town labels'))
    expect(seen.layers.find((l) => l.id === 'run-start-dot')?.type).toBe('circle')
    expect(seen.layers.find((l) => l.id === 'run-cursor')?.type).toBe('circle')
    // A single colour, not a pace ramp.
    expect(typeof seen.layers.find((l) => l.id === 'route-line')?.paint?.['line-color']).toBe('string')
    expect(seen.markers).toBe(0)
  })

  it('credits MapTiler and OpenStreetMap behind an ⓘ, with no MapLibre control', async () => {
    render(<ActivityMap route={[[7.7, 48.6], [7.72, 48.62]]} />)
    await waitFor(() => expect(seen.layers.some((l) => l.id === 'route-line')).toBe(true))
    expect(seen.controls).toEqual([])
    expect(screen.getByTestId('map-attribution')).toBeInTheDocument()
  })
})
