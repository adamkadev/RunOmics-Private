import { render, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => ({
  layers: [] as { id: string; type: string; paint?: Record<string, unknown> }[],
  markers: 0,
  before: [] as (string | undefined)[],
  controls: [] as unknown[],
}))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  class FakeMap {
    layers: { id: string; type: string }[] = [{ id: 'Town labels', type: 'symbol' }]
    sources = new Set<string>()
    constructor() { seen.layers = this.layers }
    addControl(control: unknown) { seen.controls.push(control) }
    once() {}
    on(event: string, cb: () => void) { if (event === 'load') queueMicrotask(cb) }
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
  beforeAll(() => { process.env.NEXT_PUBLIC_MAPTILER_TOKEN = 'test' })

  it('draws the route under the labels in the accent, the start and the scrub marker as circle layers, no DOM markers', async () => {
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

  it('keeps the MapTiler and OpenStreetMap credit shown as text, not folded behind an ⓘ', async () => {
    render(<ActivityMap route={[[7.7, 48.6], [7.72, 48.62]]} />)
    await waitFor(() => expect(seen.controls.length).toBeGreaterThan(0))
    expect(seen.controls.at(-1)).toMatchObject({ options: { compact: false } })
  })
})
