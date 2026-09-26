import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  EDGE_FENCE_LAYER,
  FINISH_ICON,
  ROUTE_CASING_LAYER,
  ROUTE_FIT_PADDING,
  ROUTE_LINE_LAYER,
  RUN_MARKERS_LAYER,
  START_ICON,
  addEdgeFence,
  addRouteLayers,
  addRunMarkers,
  edgePoints,
  markerPoints,
} from '../runMapLayers'

function fakeMap() {
  const layers: { id: string; type: string; layout?: Record<string, unknown> }[] = [
    { id: 'Water', type: 'fill' },
    { id: 'Town labels', type: 'symbol' },
  ]
  const images = new Set<string>()
  const data: Record<string, unknown> = {}
  const handlers: Record<string, (() => void)[]> = {}
  const map = {
    getStyle: () => ({ layers }),
    addSource: (id: string, src: { data: unknown }) => { data[id] = src.data },
    getSource: (id: string) => ({ setData: (d: unknown) => { data[id] = d } }),
    addLayer: (layer: { id: string; type: string }, before?: string) => {
      const at = before ? layers.findIndex((l) => l.id === before) : layers.length
      layers.splice(at, 0, layer)
    },
    hasImage: (id: string) => images.has(id),
    addImage: (id: string) => { images.add(id) },
    getCanvas: () => ({ clientWidth: 48, clientHeight: 32 }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
    on: (e: string, cb: () => void) => { (handlers[e] ??= []).push(cb) },
    off: () => {},
  } as unknown as MapLibreMap
  return { map, layers, images, data, handlers }
}

const IMAGE = { width: 2, height: 2, data: new Uint8Array(16) }

describe('the run map layers (v4.10)', () => {
  it('puts the route directly under the first label layer, so names draw over it', () => {
    const { map, layers } = fakeMap()
    addRouteLayers(map, { casing: '#000', lineColor: '#0f0' })
    expect(layers.map((l) => l.id)).toEqual(['Water', ROUTE_CASING_LAYER, ROUTE_LINE_LAYER, 'Town labels'])
  })

  it('draws start and finish as a symbol layer on top, placed always, taking part in collision', () => {
    const { map, layers, images } = fakeMap()
    addRunMarkers(map, [7.7, 48.6], { start: IMAGE, finish: IMAGE })
    const markers = layers.at(-1)!
    expect(markers).toMatchObject({ id: RUN_MARKERS_LAYER, type: 'symbol' })
    expect(markers.layout).toMatchObject({ 'icon-allow-overlap': true, 'icon-ignore-placement': false })
    expect([...images]).toEqual([START_ICON, FINISH_ICON])
  })

  it('adds the finish once it is known', () => {
    expect(markerPoints([1, 1], null).features).toHaveLength(1)
    expect(markerPoints([1, 1], [2, 2]).features.map((f) => f.properties?.icon)).toEqual([START_ICON, FINISH_ICON])
  })

  it('fences the four edges so a label that would be cut there is dropped instead', () => {
    const { map, layers, data, handlers } = fakeMap()
    addEdgeFence(map)
    expect(layers.at(-1)).toMatchObject({ id: EDGE_FENCE_LAYER, type: 'symbol', layout: { 'icon-allow-overlap': true, 'icon-ignore-placement': false } })
    const fence = data[EDGE_FENCE_LAYER] as { features: { geometry: { coordinates: number[] } }[] }
    expect(fence.features.map((f) => f.geometry.coordinates)).toEqual(edgePoints(48, 32).map(([x, y]) => [x, y]))
    expect(handlers.moveend).toHaveLength(1)
  })

  it('walks every edge in 16 px steps, corners included', () => {
    expect(edgePoints(32, 32)).toEqual([[0, 0], [0, 32], [16, 0], [16, 32], [32, 0], [32, 32], [0, 16], [32, 16]])
  })

  it('fits the route clear of the expand button', () => {
    expect(ROUTE_FIT_PADDING).toEqual({ top: 32, right: 24, bottom: 24, left: 24 })
  })
})
