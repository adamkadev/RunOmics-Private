import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { accentColor } from '@/lib/accent'
import { SURFACES } from '@/lib/themeTokens'
import {
  ROUTE_CASING_LAYER,
  ROUTE_CONNECTOR_LAYER,
  ROUTE_KNOWN_LAYER,
  ROUTE_LAYERS,
  ROUTE_NEW_LAYER,
  ROUTE_SOURCE,
  ROUTE_SOURCES,
  ROUTE_START_IMAGE,
  ROUTE_START_LAYER,
  addRouteLayers,
  hasRouteLayers,
  removeRouteLayers,
  routeColors,
  routeGeoJson,
  setRouteData,
  startDotImage,
  type RouteDrawing,
} from '../routeLayer'
import { FakeMap } from './fakeMap'

const asMap = (fake: FakeMap) => fake as unknown as MapLibreMap

const HOME: [number, number] = [-150.01, 44.99]
const DRAWING: RouteDrawing = {
  coordinates: [[-150, 45, 100], [-149.99, 45, 101], [-149.98, 45, 102], [-149.98, 45.01, 103], [-150, 45, 100]],
  // known, new, new, known
  newSteps: [false, true, true, false],
  home: HOME,
}

const kinds = (geo: ReturnType<typeof routeGeoJson>) => geo.route.features.map((f) => [f.properties.kind, f.geometry.coordinates.length])

describe('routeGeoJson', () => {
  it('draws the loop once for its casing, then each run of new or known steps, end to end', () => {
    const geo = routeGeoJson(DRAWING)
    expect(kinds(geo)).toEqual([['loop', 5], ['known', 2], ['new', 3], ['known', 2]])
    // Neighbouring runs share their end point, so the colours meet.
    const [, known, fresh, last] = geo.route.features
    expect(known!.geometry.coordinates.at(-1)).toEqual(fresh!.geometry.coordinates[0])
    expect(fresh!.geometry.coordinates.at(-1)).toEqual(last!.geometry.coordinates[0])
    // Two dimensions on the map: the elevation is the GPX's.
    expect(geo.route.features[0]!.geometry.coordinates[0]).toEqual([-150, 45])
  })

  it('starts the dot on the loop’s first point, and the connector from home to it', () => {
    const geo = routeGeoJson(DRAWING)
    expect(geo.start.features[0]!.geometry.coordinates).toEqual([-150, 45])
    expect(geo.connector.features[0]!.geometry.coordinates).toEqual([HOME, [-150, 45]])
  })

  it('draws no connector without a home, and nothing at all without a loop', () => {
    expect(routeGeoJson({ ...DRAWING, home: null }).connector.features).toEqual([])
    const none = routeGeoJson(null)
    expect([none.route.features, none.start.features, none.connector.features]).toEqual([[], [], []])
    expect(routeGeoJson({ ...DRAWING, coordinates: [[-150, 45]] }).route.features).toEqual([])
  })

  it('takes a step with no flag as known', () => {
    expect(kinds(routeGeoJson({ ...DRAWING, newSteps: [] }))).toEqual([['loop', 5], ['known', 5]])
  })
})

describe('routeColors', () => {
  it('draws new ground in the accent and known streets in the foreground colour, per mode', () => {
    expect(routeColors('dark', 'teal')).toMatchObject({ new: accentColor('teal', 'dark'), known: SURFACES.dark.text, startStroke: accentColor('teal', 'dark') })
    expect(routeColors('light', 'teal')).toMatchObject({ new: accentColor('teal', 'light'), known: SURFACES.light.text, startFill: '#ffffff' })
    // The casing: black under the dark map's lines, white under the light one's.
    expect(routeColors('dark', 'teal').casing).toBe('rgba(0, 0, 0, 0.6)')
    expect(routeColors('light', 'teal').casing).toBe('rgba(255, 255, 255, 0.9)')
  })

  it('steps the known streets back in mono, whose accent is the foreground colour', () => {
    const mono = routeColors('dark', 'mono')
    expect(mono.known).not.toBe(mono.new)
    expect(mono.known).toBe(SURFACES.dark.text2)
  })
})

describe('startDotImage', () => {
  it('is a filled dot in an accent ring, transparent at its corners', () => {
    const image = startDotImage('#ffffff', '#0e8468', 2)
    const { width, height, data } = image
    expect(width).toBe(height)
    const px = (x: number, y: number) => [...data.slice(4 * (y * width + x), 4 * (y * width + x) + 4)]
    const c = Math.floor(width / 2)
    expect(px(c, c)).toEqual([255, 255, 255, 255])
    expect(px(0, 0)[3]).toBe(0)
    // On the ring, 8 pt out at pixel ratio 2: the accent.
    expect(px(c + 16, c).slice(0, 3)).toEqual([0x0e, 0x84, 0x68])
  })
})

describe('the route layers on a map', () => {
  it('adds the lines over the run layers and under the first label, the dot over every label, under the fence', () => {
    const map = new FakeMap()
    map.addLayer({ id: 'home-dot', type: 'circle' }, 'Ocean labels')
    map.addLayer({ id: 'runomics-districts-label-next', type: 'symbol' })
    map.addLayer({ id: 'map-edge-fence', type: 'symbol' })
    setRouteData(asMap(map), DRAWING)
    addRouteLayers(asMap(map), { mode: 'dark', accent: 'teal' })

    const ids = map.ids()
    const lines = [ROUTE_CONNECTOR_LAYER, ROUTE_CASING_LAYER, ROUTE_NEW_LAYER, ROUTE_KNOWN_LAYER]
    expect(ids.slice(ids.indexOf('home-dot'), ids.indexOf('home-dot') + 6)).toEqual(['home-dot', ...lines, 'Ocean labels'])
    expect(ids.slice(-3)).toEqual(['runomics-districts-label-next', ROUTE_START_LAYER, 'map-edge-fence'])
    expect(map.getLayer(ROUTE_START_LAYER)!.layout).toMatchObject({ 'icon-image': ROUTE_START_IMAGE, 'icon-allow-overlap': true, 'icon-ignore-placement': false })
    expect(map.hasImage(ROUTE_START_IMAGE)).toBe(true)
    expect(map.getLayer(ROUTE_NEW_LAYER)!.paint!['line-color']).toBe(accentColor('teal', 'dark'))
    expect(map.getLayer(ROUTE_CONNECTOR_LAYER)!.paint!['line-dasharray']).toEqual([2, 2])
    // The drawing set before the layers came is what they show.
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(4)
  })

  it('takes a new loop in place, and clears it with null', () => {
    const map = new FakeMap()
    addRouteLayers(asMap(map), { mode: 'light', accent: 'teal' })
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toEqual([])
    setRouteData(asMap(map), DRAWING)
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(4)
    setRouteData(asMap(map), null)
    expect((map.getSource(ROUTE_SOURCE)!.data as { features: unknown[] }).features).toEqual([])
  })

  it('is replaced whole when added again (a new accent), and leaves nothing behind when removed', () => {
    const map = new FakeMap()
    const before = map.ids()
    setRouteData(asMap(map), DRAWING)
    addRouteLayers(asMap(map), { mode: 'light', accent: 'teal' })
    addRouteLayers(asMap(map), { mode: 'light', accent: 'violet' })
    expect(map.ids().filter((id) => id.startsWith('runomics-route'))).toHaveLength(ROUTE_LAYERS.length)
    expect(map.getLayer(ROUTE_NEW_LAYER)!.paint!['line-color']).toBe(accentColor('violet', 'light'))

    removeRouteLayers(asMap(map))
    expect(map.ids()).toEqual(before)
    expect(ROUTE_SOURCES.filter((id) => map.getSource(id))).toEqual([])
    expect(map.hasImage(ROUTE_START_IMAGE)).toBe(false)
    expect(hasRouteLayers(asMap(map))).toBe(false)
    // Nothing on the map: removing again is a no-op.
    removeRouteLayers(asMap(map))
  })
})
