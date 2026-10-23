import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson'
import type { FilterSpecification, GeoJSONSource, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { accentColor, type AccentId } from '@/lib/accent'
import { firstSymbolLayerId } from '@/lib/maplibre'
import { ink, paper, rgbTriplet, white, withAlpha } from '@/lib/palette'
import { EDGE_FENCE_LAYER } from '@/lib/runMapLayers'
import { SURFACES } from '@/lib/themeTokens'

/**
 * A generated loop on the Districts map (Explore, S3/S4): the dashed way from
 * home to the loop's start, the loop on a casing, its new ground in the
 * accent and its known streets in the foreground colour, and the start dot.
 *
 * MapLibre glue only, driven by a fake map in tests. Colours are literal,
 * resolved for the mode and accent they are drawn in; a theme or accent
 * change removes and re-adds the whole layer (the `useMapRoutes` overlay),
 * from the drawing last set on the map.
 *
 * The lines go over the Districts shapes, the home ring and its dot, under
 * every label: a quartier's name stays readable on its own loop. The start
 * dot is a symbol over the labels, always placed: the quartier's name (its
 * start is picked near the name's point) makes room for it rather than
 * cover it. Home is only ever drawn here, on the device: the GPX holds the
 * loop alone.
 */

export const ROUTE_CONNECTOR_SOURCE = 'runomics-route-connector'
export const ROUTE_SOURCE = 'runomics-route'
export const ROUTE_START_SOURCE = 'runomics-route-start'

export const ROUTE_CONNECTOR_LAYER = 'runomics-route-connector'
export const ROUTE_CASING_LAYER = 'runomics-route-casing'
export const ROUTE_NEW_LAYER = 'runomics-route-new'
export const ROUTE_KNOWN_LAYER = 'runomics-route-known'
export const ROUTE_START_LAYER = 'runomics-route-start'
export const ROUTE_START_IMAGE = 'runomics-route-start'

/** Bottom to top (design spec §6). */
export const ROUTE_LAYERS = [ROUTE_CONNECTOR_LAYER, ROUTE_CASING_LAYER, ROUTE_NEW_LAYER, ROUTE_KNOWN_LAYER, ROUTE_START_LAYER] as const
export const ROUTE_SOURCES = [ROUTE_CONNECTOR_SOURCE, ROUTE_SOURCE, ROUTE_START_SOURCE] as const

const LINE_WIDTH = 4.5
const CASING_WIDTH = 9
const CONNECTOR_WIDTH = 3
/** 6 px dashes 6 px apart at 3 px: a dash array counts line widths. */
const CONNECTOR_DASH = [2, 2]
/**
 * The mockup's start dot is r 8 with a 3.5 stroke centred on it: a fill out
 * to 6.25 px and the stroke on to 9.75 px.
 */
const START_STROKE = 3.5
const START_RADIUS = 8 - START_STROKE / 2
const START_PIXEL_RATIO = 2

export type RouteMode = 'light' | 'dark'

export interface RouteColors {
  connector: string
  casing: string
  new: string
  known: string
  startFill: string
  startStroke: string
}

/**
 * Every colour for one mode and accent (design spec §6): new ground in the
 * accent, known streets in the foreground colour. Mono's accent is the
 * foreground colour, so there the known streets step back to the secondary
 * text colour - new and known would otherwise draw alike.
 */
export function routeColors(mode: RouteMode, accent: AccentId): RouteColors {
  const acc = accentColor(accent, mode)
  const s = SURFACES[mode]
  const known = accent === 'mono' ? s.text2 : s.text
  return mode === 'dark'
    ? { connector: withAlpha(s.text, 0.5), casing: ink(0.6), new: acc, known, startFill: s.text, startStroke: acc }
    : { connector: withAlpha(s.text, 0.45), casing: paper(0.9), new: acc, known, startFill: white, startStroke: acc }
}

/** A loop to draw, and where home is (the connector's far end); null home draws no connector. */
export interface RouteDrawing {
  /** [lon, lat] or [lon, lat, ele], start first; the loop closes on its own start. */
  coordinates: readonly (readonly number[])[]
  /** One per step (coordinates − 1): true where the step is new ground. */
  newSteps: readonly boolean[]
  home: [number, number] | null
}

export type RouteKind = 'loop' | 'new' | 'known'

export interface RouteGeoJson {
  connector: FeatureCollection<LineString>
  route: FeatureCollection<LineString, { kind: RouteKind }>
  start: FeatureCollection<Point>
}

const empty = <G extends LineString | Point, P = Record<string, never>>(): FeatureCollection<G, P> => ({ type: 'FeatureCollection', features: [] })

const lonLat = (p: readonly number[]): Position => [p[0]!, p[1]!]

/**
 * The drawing as GeoJSON: the whole loop once (its casing), then each run of
 * consecutive new or known steps as a line of its own, sharing its end
 * points with its neighbours so the colours meet without a gap.
 */
export function routeGeoJson(drawing: RouteDrawing | null): RouteGeoJson {
  const connector = empty<LineString>()
  const route = empty<LineString, { kind: RouteKind }>()
  const start = empty<Point>()
  const coords = (drawing?.coordinates ?? []).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  if (!drawing || coords.length < 2) return { connector, route, start }

  const line = (from: number, to: number): Position[] => coords.slice(from, to + 1).map(lonLat)
  route.features.push({ type: 'Feature', properties: { kind: 'loop' }, geometry: { type: 'LineString', coordinates: line(0, coords.length - 1) } })
  let runStart = 0
  const steps = coords.length - 1
  for (let s = 1; s <= steps; s++) {
    const flag = drawing.newSteps[runStart] ?? false
    if (s < steps && (drawing.newSteps[s] ?? false) === flag) continue
    route.features.push({
      type: 'Feature',
      properties: { kind: flag ? 'new' : 'known' },
      geometry: { type: 'LineString', coordinates: line(runStart, s) },
    } satisfies Feature<LineString, { kind: RouteKind }>)
    runStart = s
  }

  const first = lonLat(coords[0]!)
  start.features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: first } })
  if (drawing.home) {
    connector.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[...drawing.home], first] } })
  }
  return { connector, route, start }
}

// --- per-map state ---------------------------------------------------------

const drawings = new WeakMap<MapLibreMap, RouteGeoJson>()

function dataOf(map: MapLibreMap): RouteGeoJson {
  return drawings.get(map) ?? routeGeoJson(null)
}

function kindFilter(kind: RouteKind): FilterSpecification {
  return ['==', ['get', 'kind'], kind] as FilterSpecification
}

/**
 * The start dot, rasterised at `pixelRatio`: the fill, then the accent ring
 * around it, anti-aliased at both edges. Straight (not premultiplied) RGBA,
 * as MapLibre takes it.
 */
export function startDotImage(fill: string, stroke: string, pixelRatio = START_PIXEL_RATIO): { width: number; height: number; data: Uint8Array } {
  const outer = (START_RADIUS + START_STROKE) * pixelRatio
  const inner = START_RADIUS * pixelRatio
  const size = Math.ceil(outer * 2) + 2
  const centre = size / 2
  const data = new Uint8Array(size * size * 4)
  const f = rgbTriplet(fill)
  const k = rgbTriplet(stroke)
  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - centre, y + 0.5 - centre)
      const alpha = clamp(outer + 0.5 - d)
      if (alpha <= 0) continue
      // How much of the pixel is fill rather than ring.
      const inside = clamp(inner + 0.5 - d)
      const i = 4 * (y * size + x)
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(f[c]! * inside + k[c]! * (1 - inside))
      data[i + 3] = Math.round(alpha * 255)
    }
  }
  return { width: size, height: size, data }
}

function routeLayers(c: RouteColors): LayerSpecification[] {
  const round = { 'line-join': 'round', 'line-cap': 'round' } as const
  return [
    {
      id: ROUTE_CONNECTOR_LAYER,
      type: 'line',
      source: ROUTE_CONNECTOR_SOURCE,
      layout: round,
      paint: { 'line-color': c.connector, 'line-width': CONNECTOR_WIDTH, 'line-dasharray': CONNECTOR_DASH },
    },
    {
      id: ROUTE_CASING_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      filter: kindFilter('loop'),
      layout: round,
      paint: { 'line-color': c.casing, 'line-width': CASING_WIDTH },
    },
    {
      id: ROUTE_NEW_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      filter: kindFilter('new'),
      layout: round,
      paint: { 'line-color': c.new, 'line-width': LINE_WIDTH },
    },
    {
      id: ROUTE_KNOWN_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      filter: kindFilter('known'),
      layout: round,
      paint: { 'line-color': c.known, 'line-width': LINE_WIDTH },
    },
    {
      id: ROUTE_START_LAYER,
      type: 'symbol',
      source: ROUTE_START_SOURCE,
      // Always drawn, and in the way of any label that would cover it.
      layout: { 'icon-image': ROUTE_START_IMAGE, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
    },
  ] as LayerSpecification[]
}

export interface RouteLayerOptions {
  mode: RouteMode
  accent: AccentId
}

/**
 * Adds the sources and layers, in place, with the drawing last set on this
 * map, under the first label. Calling it again replaces them (a new mode or
 * accent).
 */
export function addRouteLayers(map: MapLibreMap, { mode, accent }: RouteLayerOptions): void {
  removeRouteLayers(map)
  const data = dataOf(map)
  map.addSource(ROUTE_CONNECTOR_SOURCE, { type: 'geojson', data: data.connector })
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: data.route })
  map.addSource(ROUTE_START_SOURCE, { type: 'geojson', data: data.start })
  const colors = routeColors(mode, accent)
  map.addImage(ROUTE_START_IMAGE, startDotImage(colors.startFill, colors.startStroke), { pixelRatio: START_PIXEL_RATIO })
  // The lines under the first label; the dot over every label, under the edge fence.
  const lines = firstSymbolLayerId(map)
  const top = map.getLayer(EDGE_FENCE_LAYER) ? EDGE_FENCE_LAYER : undefined
  for (const layer of routeLayers(colors)) map.addLayer(layer, layer.id === ROUTE_START_LAYER ? top : lines)
}

/** The loop to show; null clears it (the layers stay, empty). */
export function setRouteData(map: MapLibreMap, drawing: RouteDrawing | null): void {
  const data = routeGeoJson(drawing)
  drawings.set(map, data)
  ;(map.getSource(ROUTE_CONNECTOR_SOURCE) as GeoJSONSource | undefined)?.setData(data.connector)
  ;(map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(data.route)
  ;(map.getSource(ROUTE_START_SOURCE) as GeoJSONSource | undefined)?.setData(data.start)
}

/** Takes every layer and source off the map; the drawing is kept for the next add. */
export function removeRouteLayers(map: MapLibreMap): void {
  for (const id of [...ROUTE_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of ROUTE_SOURCES) if (map.getSource(id)) map.removeSource(id)
  if (map.hasImage(ROUTE_START_IMAGE)) map.removeImage(ROUTE_START_IMAGE)
}

export function hasRouteLayers(map: MapLibreMap): boolean {
  return !!map.getSource(ROUTE_SOURCE)
}
