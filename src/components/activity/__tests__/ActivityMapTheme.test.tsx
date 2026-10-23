import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maptilerStyle } from '@/lib/maptiler'

// A map whose styles load when the test says: setStyle starts a load, and
// `finish()` ends it, firing style.load.
const maps = vi.hoisted(() => ({ built: [] as { styles: unknown[]; finish: () => void }[] }))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  class FakeMap {
    layers: { id: string; type: string }[] = [{ id: 'Town labels', type: 'symbol' }]
    sources = new Set<string>()
    handlers: (() => void)[] = []
    styles: unknown[] = []
    loaded = false
    constructor(options: { style: unknown }) {
      this.styles.push(options.style)
      maps.built.push(this)
    }
    finish() {
      this.loaded = true
      for (const cb of this.handlers) cb()
    }
    addControl() {}
    once() {}
    on(event: string, cb: () => void) {
      if (event === 'style.load') this.handlers.push(cb)
    }
    isStyleLoaded() { return this.loaded }
    setStyle(style: unknown) {
      this.styles.push(style)
      this.loaded = false
      this.layers.splice(0, this.layers.length, { id: 'Town labels', type: 'symbol' })
      this.sources.clear()
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
    addLayer(layer: { id: string; type: string }) { this.layers.push(layer) }
    hasImage() { return false }
    addImage() {}
    updateImage() {}
    project() { return { x: 0, y: 0 } }
    getCanvas() { return { clientWidth: 100, clientHeight: 100 } }
    unproject() { return { lng: 0, lat: 0 } }
  }
  class FakeBounds { extend() { return this } }
  class FakeMarker { setLngLat() { return this } addTo() { return this } remove() {} }
  return {
    ...real,
    loadMapLibre: async () => ({ Map: FakeMap, LngLatBounds: FakeBounds, AttributionControl: class {}, Marker: FakeMarker }),
  }
})

const { default: ActivityMap } = await import('../ActivityMap')

const TOKEN = 'test-token'
const isDarkStyle = (style: unknown) => JSON.stringify(style) === JSON.stringify(maptilerStyle(true, TOKEN))
/** The observer runs after a microtask. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// iOS draws its app-switcher snapshots in both appearances, so a page that follows the system flips to light and back,
// the flip back landing while the light style still loads.
describe('the activity map across a theme that flips and flips back', () => {
  beforeEach(() => {
    maps.built.length = 0
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', TOKEN)
    document.documentElement.classList.add('dark')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    document.documentElement.classList.remove('dark')
  })

  it('ends on the theme the page ends on, even when the flip back came mid-load', async () => {
    render(<ActivityMap route={[[7.7, 48.6], [7.72, 48.62]]} />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    expect(isDarkStyle(map.styles[0])).toBe(true)
    map.finish()

    // The snapshot in light: the map starts loading its light style...
    document.documentElement.classList.remove('dark')
    await tick()
    expect(map.styles).toHaveLength(2)
    expect(isDarkStyle(map.styles[1])).toBe(false)
    // ...and the page is dark again before that style has loaded.
    document.documentElement.classList.add('dark')
    await tick()
    map.finish()

    expect(isDarkStyle(map.styles.at(-1))).toBe(true)
  })
})
