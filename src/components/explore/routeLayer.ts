import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson'
import type { FilterSpecification, GeoJSONSource, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { avoidRing, type AvoidCircle } from '@/domain/explore/avoidSpots'
import { accentColor, type AccentId } from '@/lib/accent'
import { firstSymbolLayerId } from '@/lib/maplibre'
import { ink, paper, rgbTriplet, white, withAlpha } from '@/lib/palette'
import { EDGE_FENCE_LAYER } from '@/lib/runMapLayers'
import { STATUS_HEX, SURFACES } from '@/lib/themeTokens'

/**
 * Colours are literal, resolved for the mode and accent they are drawn in: a theme or accent change
 * re-adds the whole layer. The lines go under every label so a quartier's name stays readable on its
 * own loop. Home and the runner's start are only ever drawn here, on the device: the GPX holds the loop alone.
 */

export const ROUTE_CONNECTOR_SOURCE = 'runomics-route-connector'
export const ROUTE_SOURCE = 'runomics-route'
export const ROUTE_START_SOURCE = 'runomics-route-start'
export const ROUTE_AVOID_SOURCE = 'runomics-route-avoid'

export const ROUTE_AVOID_FILL_LAYER = 'runomics-route-avoid-fill'
export const ROUTE_AVOID_LINE_LAYER = 'runomics-route-avoid-line'
export const ROUTE_CONNECTOR_LAYER = 'runomics-route-connector'
export const ROUTE_CASING_LAYER = 'runomics-route-casing'
export const ROUTE_NEW_LAYER = 'runomics-route-new'
export const ROUTE_KNOWN_LAYER = 'runomics-route-known'
export const ROUTE_START_LAYER = 'runomics-route-start'
export const ROUTE_START_IMAGE = 'runomics-route-start'

/** Bottom to top. */
export const ROUTE_LAYERS = [
  ROUTE_AVOID_FILL_LAYER,
  ROUTE_AVOID_LINE_LAYER,
  ROUTE_CONNECTOR_LAYER,
  ROUTE_CASING_LAYER,
  ROUTE_NEW_LAYER,
  ROUTE_KNOWN_LAYER,
  ROUTE_START_LAYER,
] as const
export const ROUTE_SOURCES = [ROUTE_AVOID_SOURCE, ROUTE_CONNECTOR_SOURCE, ROUTE_SOURCE, ROUTE_START_SOURCE] as const

const LINE_WIDTH = 4.5
const CASING_WIDTH = 9
const CONNECTOR_WIDTH = 3
/** 6 px dashes 6 px apart at 3 px: a dash array counts line widths. */
const CONNECTOR_DASH = [2, 2]
/** A dot of radius 8 px with its 3.5 px stroke centred on the edge. */
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
  avoid: string
}

/** Mono's accent is the foreground colour, so its known streets step back to the secondary text colour. */
export function routeColors(mode: RouteMode, accent: AccentId): RouteColors {
  const acc = accentColor(accent, mode)
  const s = SURFACES[mode]
  const known = accent === 'mono' ? s.text2 : s.text
  const avoid = STATUS_HEX[mode].neg
  return mode === 'dark'
    ? { connector: withAlpha(s.text, 0.5), casing: ink(0.6), new: acc, known, startFill: s.text, startStroke: acc, avoid }
    : { connector: withAlpha(s.text, 0.45), casing: paper(0.9), new: acc, known, startFill: white, startStroke: acc, avoid }
}

export interface RouteDrawing {
  /** [lon, lat] or [lon, lat, ele], start first; the loop closes on its own start. */
  coordinates: readonly (readonly number[])[]
  /** One per step (coordinates − 1): true where the step is new ground. */
  newSteps: readonly boolean[]
  /** Where the dashed line to the loop begins: home, or the tapped start; with no loop yet, the start dot. */
  from: [number, number] | null
  /** The spots marked to avoid, drawn whether or not a loop is. */
  avoid?: readonly AvoidCircle[]
}

export type RouteKind = 'loop' | 'new' | 'known'

export interface RouteGeoJson {
  connector: FeatureCollection<LineString>
  route: FeatureCollection<LineString, { kind: RouteKind }>
  start: FeatureCollection<Point>
  avoid: FeatureCollection<Polygon>
}

const empty = <G extends LineString | Point, P = Record<string, never>>(): FeatureCollection<G, P> => ({ type: 'FeatureCollection', features: [] })

const lonLat = (p: readonly number[]): Position => [p[0]!, p[1]!]

/** Each run of new or known steps shares its end points with its neighbours, so the colours meet without a gap. */
export function routeGeoJson(drawing: RouteDrawing | null): RouteGeoJson {
  const connector = empty<LineString>()
  const route = empty<LineString, { kind: RouteKind }>()
  const start = empty<Point>()
  const avoid: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: (drawing?.avoid ?? []).map((circle) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [avoidRing(circle)] } })),
  }
  const coords = (drawing?.coordinates ?? []).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  if (!drawing || coords.length < 2) {
    if (drawing?.from) start.features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [...drawing.from] } })
    return { connector, route, start, avoid }
  }

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
  if (drawing.from) {
    connector.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[...drawing.from], first] } })
  }
  return { connector, route, start, avoid }
}

const drawings = new WeakMap<MapLibreMap, RouteGeoJson>()

function dataOf(map: MapLibreMap): RouteGeoJson {
  return drawings.get(map) ?? routeGeoJson(null)
}

function kindFilter(kind: RouteKind): FilterSpecification {
  return ['==', ['get', 'kind'], kind] as FilterSpecification
}

/** Straight (not premultiplied) RGBA, as MapLibre takes it. */
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
    { id: ROUTE_AVOID_FILL_LAYER, type: 'fill', source: ROUTE_AVOID_SOURCE, paint: { 'fill-color': c.avoid, 'fill-opacity': 0.18 } },
    {
      id: ROUTE_AVOID_LINE_LAYER,
      type: 'line',
      source: ROUTE_AVOID_SOURCE,
      paint: { 'line-color': c.avoid, 'line-width': 1.5, 'line-dasharray': [2, 1.5] },
    },
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

export function addRouteLayers(map: MapLibreMap, { mode, accent }: RouteLayerOptions): void {
  removeRouteLayers(map)
  const data = dataOf(map)
  map.addSource(ROUTE_AVOID_SOURCE, { type: 'geojson', data: data.avoid })
  map.addSource(ROUTE_CONNECTOR_SOURCE, { type: 'geojson', data: data.connector })
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: data.route })
  map.addSource(ROUTE_START_SOURCE, { type: 'geojson', data: data.start })
  const colors = routeColors(mode, accent)
  map.addImage(ROUTE_START_IMAGE, startDotImage(colors.startFill, colors.startStroke), { pixelRatio: START_PIXEL_RATIO })
  const lines = firstSymbolLayerId(map)
  const top = map.getLayer(EDGE_FENCE_LAYER) ? EDGE_FENCE_LAYER : undefined
  for (const layer of routeLayers(colors)) map.addLayer(layer, layer.id === ROUTE_START_LAYER ? top : lines)
}

export function setRouteData(map: MapLibreMap, drawing: RouteDrawing | null): void {
  const data = routeGeoJson(drawing)
  drawings.set(map, data)
  ;(map.getSource(ROUTE_CONNECTOR_SOURCE) as GeoJSONSource | undefined)?.setData(data.connector)
  ;(map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(data.route)
  ;(map.getSource(ROUTE_START_SOURCE) as GeoJSONSource | undefined)?.setData(data.start)
  ;(map.getSource(ROUTE_AVOID_SOURCE) as GeoJSONSource | undefined)?.setData(data.avoid)
}

/** The drawing is kept for the next add. */
export function removeRouteLayers(map: MapLibreMap): void {
  for (const id of [...ROUTE_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of ROUTE_SOURCES) if (map.getSource(id)) map.removeSource(id)
  if (map.hasImage(ROUTE_START_IMAGE)) map.removeImage(ROUTE_START_IMAGE)
}
