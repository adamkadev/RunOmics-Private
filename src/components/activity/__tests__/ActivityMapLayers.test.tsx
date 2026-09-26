import { render, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => ({ layers: [] as { id: string; type: string }[], markers: 0, before: [] as (string | undefined)[] }))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  class FakeMap {
    layers: { id: string; type: string }[] = [{ id: 'Town labels', type: 'symbol' }]
    constructor() { seen.layers = this.layers }
    addControl() {}
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
    addSource() {}
    getSource() { return { setData() {} } }
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
    loadMapLibre: async () => ({ Map: FakeMap, LngLatBounds: FakeBounds, AttributionControl: class {}, Marker: FakeMarker }),
  }
})

vi.mock('@/lib/runMapLayers', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/runMapLayers')>()
  // jsdom has no 2D canvas to draw the marker icons with.
  return { ...real, markerImage: () => ({ width: 2, height: 2, data: new Uint8Array(16) }) }
})

const { default: ActivityMap } = await import('../ActivityMap')

describe('ActivityMap layers (v4.10)', () => {
  beforeAll(() => { process.env.NEXT_PUBLIC_MAPTILER_TOKEN = 'test' })

  it('puts the route under the labels and the start and finish in a symbol layer, not DOM markers', async () => {
    render(<ActivityMap route={[[7.7, 48.6], [7.72, 48.62]]} />)
    await waitFor(() => expect(seen.layers.some((l) => l.id === 'run-start-finish')).toBe(true))
    const ids = seen.layers.map((l) => l.id)
    expect(ids.indexOf('route-line')).toBeLessThan(ids.indexOf('Town labels'))
    expect(ids.indexOf('route-bg')).toBeLessThan(ids.indexOf('Town labels'))
    expect(ids.indexOf('run-start-finish')).toBeGreaterThan(ids.indexOf('Town labels'))
    expect(seen.layers.find((l) => l.id === 'run-start-finish')?.type).toBe('symbol')
    expect(seen.markers).toBe(0)
  })
})
