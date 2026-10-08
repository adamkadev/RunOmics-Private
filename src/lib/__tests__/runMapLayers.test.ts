import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  EDGE_FENCE_LAYER,
  FINISH_ICON,
  FINISH_MARK_ICON,
  ROUTE_FIT_PADDING,
  ROUTE_LINE_LAYER,
  ROUTE_SOURCE,
  RUN_CURSOR_LAYER,
  RUN_CURSOR_SOURCE,
  RUN_FINISH_LAYER,
  RUN_FINISH_SOURCE,
  RUN_MARKERS_LAYER,
  RUN_START_LAYER,
  START_ICON,
  addEdgeFence,
  addRunLayers,
  addRunMarkers,
  edgePoints,
  finishMarkImage,
  markerPoints,
  pointAlongRoute,
  setRunCursor,
  setRunFinishMark,
} from '../runMapLayers'

function fakeMap() {
  const layers: { id: string; type: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }[] = [
    { id: 'Water', type: 'fill' },
    { id: 'Town labels', type: 'symbol' },
  ]
  const images = new Set<string>()
  const data: Record<string, unknown> = {}
  const handlers: Record<string, (() => void)[]> = {}
  const map = {
    getStyle: () => ({ layers }),
    addSource: (id: string, src: { data: unknown }) => { data[id] = src.data },
    getSource: (id: string) => (id in data ? { setData: (d: unknown) => { data[id] = d } } : undefined),
    getLayer: (id: string) => layers.find((l) => l.id === id),
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

const RUN = {
  accent: '#2dd4a7', ring: '#ffffff', route: [[7.7, 48.6], [7.71, 48.61]] as [number, number][],
  start: [7.7, 48.6] as [number, number], finish: [7.71, 48.61] as [number, number], finishFill: '#0c0d0d', cursor: null,
}

describe('the run map layers (v4.17)', () => {
  it('puts the accent route directly under the first label layer, so names draw over it', () => {
    const { map, layers } = fakeMap()
    addRunLayers(map, RUN)
    expect(layers.map((l) => l.id)).toEqual(['Water', ROUTE_LINE_LAYER, 'Town labels', RUN_FINISH_LAYER, RUN_START_LAYER, RUN_CURSOR_LAYER])
    const route = layers.find((l) => l.id === ROUTE_LINE_LAYER)!
    expect(route).toMatchObject({ type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': RUN.accent, 'line-width': 4 } })
  })

  it('draws the start and the scrub marker as accent circles ringed in white', () => {
    const { map, layers } = fakeMap()
    addRunLayers(map, RUN)
    expect(layers.find((l) => l.id === RUN_START_LAYER)).toMatchObject({
      type: 'circle',
      paint: { 'circle-radius': 5, 'circle-color': RUN.accent, 'circle-stroke-color': RUN.ring, 'circle-stroke-width': 2 },
    })
    expect(layers.find((l) => l.id === RUN_CURSOR_LAYER)).toMatchObject({
      type: 'circle',
      paint: { 'circle-radius': 7, 'circle-color': RUN.accent, 'circle-stroke-color': RUN.ring, 'circle-stroke-width': 3 },
    })
  })

  // At the owner's request: the Activity map had no end marker at all.
  it('marks the finish with a dark square ringed in white, under the start where a loop meets it', () => {
    const { map, layers, images, data } = fakeMap()
    addRunLayers(map, RUN)
    expect(images.has(FINISH_MARK_ICON)).toBe(true)
    expect(layers.find((l) => l.id === RUN_FINISH_LAYER)).toMatchObject({
      type: 'symbol',
      layout: { 'icon-image': FINISH_MARK_ICON, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    })
    const ids = layers.map((l) => l.id)
    expect(ids.indexOf(RUN_FINISH_LAYER)).toBeLessThan(ids.indexOf(RUN_START_LAYER))
    expect((data[RUN_FINISH_SOURCE] as { features: { geometry: { coordinates: unknown } }[] }).features[0]!.geometry.coordinates).toEqual(RUN.finish)
    setRunFinishMark(map, null)
    expect((data[RUN_FINISH_SOURCE] as { features: unknown[] }).features).toHaveLength(0)
  })

  it('draws the finish square pixel by pixel: the fill inside a 2 px white ring', () => {
    const image = finishMarkImage('#0c0d0d', '#ffffff')
    expect([image.width, image.height]).toEqual([26, 26])
    const px = (x: number, y: number) => [...image.data.slice((y * 26 + x) * 4, (y * 26 + x) * 4 + 4)]
    expect(px(0, 0)).toEqual([255, 255, 255, 255])
    expect(px(3, 13)).toEqual([255, 255, 255, 255])
    expect(px(13, 13)).toEqual([12, 13, 13, 255])
  })

  // The layers go on again after a style change, as they were.
  it('can be called again without adding a layer twice, and keeps the cursor', () => {
    const { map, layers, data } = fakeMap()
    addRunLayers(map, RUN)
    setRunCursor(map, [7.705, 48.605])
    addRunLayers(map, { ...RUN, cursor: [7.705, 48.605] })
    expect(layers.filter((l) => l.id === RUN_CURSOR_LAYER)).toHaveLength(1)
    expect((data[RUN_CURSOR_SOURCE] as { features: unknown[] }).features).toHaveLength(1)
    expect((data[ROUTE_SOURCE] as { features: { geometry: { coordinates: unknown[] } }[] }).features[0]!.geometry.coordinates).toHaveLength(2)
    setRunCursor(map, null)
    expect((data[RUN_CURSOR_SOURCE] as { features: unknown[] }).features).toHaveLength(0)
  })

  // GPS points come by time: an index halfway was not halfway along.
  it('finds the point a share of the way along by distance', () => {
    const route: [number, number][] = [[0, 0], [0, 0.001], [0, 0.002], [0, 0.01]]
    expect(pointAlongRoute(route, 0)).toEqual([0, 0])
    expect(pointAlongRoute(route, 1)).toEqual([0, 0.01])
    expect(pointAlongRoute(route, 0.5)![1]).toBeCloseTo(0.005, 6)
    expect(pointAlongRoute([], 0.5)).toBeNull()
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

  it('fits the route clear of the expand button and the attribution line', () => {
    expect(ROUTE_FIT_PADDING).toEqual({ top: 32, right: 24, bottom: 36, left: 24 })
  })
})
