import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { firstSymbolLayerId } from '@/lib/maplibre'
import { distanceKm } from '@/lib/math'
import { rgbTriplet } from '@/lib/palette'

export const ROUTE_SOURCE = 'route'
export const ROUTE_LINE_LAYER = 'route-line'
export const RUN_START_SOURCE = 'run-start-dot'
export const RUN_START_LAYER = 'run-start-dot'
export const RUN_FINISH_SOURCE = 'run-finish-mark'
export const RUN_FINISH_LAYER = 'run-finish-mark'
export const FINISH_MARK_ICON = 'run-finish-mark'
export const RUN_CURSOR_SOURCE = 'run-cursor'
export const RUN_CURSOR_LAYER = 'run-cursor'
export const RUN_MARKERS_SOURCE = 'run-start-finish'
export const RUN_MARKERS_LAYER = 'run-start-finish'
export const EDGE_FENCE_SOURCE = 'map-edge-fence'
export const EDGE_FENCE_LAYER = 'map-edge-fence'
export const START_ICON = 'run-start'
export const FINISH_ICON = 'run-finish'
const FENCE_ICON = 'map-edge-fence'

/**
 * The route fitted clear of the edges, a little more at the top for the
 * expand button and at the bottom for the attribution line (v4.17).
 */
export const ROUTE_FIT_PADDING = { top: 32, right: 24, bottom: 36, left: 24 } as const

type LngLat = [number, number]
type Image = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** What the Activity map shows of the run: the route drawn so far, its start and finish, and the scrub's point. */
export interface RunLayersState {
  /** The accent, as a literal colour: MapLibre paints values, not CSS variables. */
  accent: string
  /** The ring round the start, the finish and the scrub marker. */
  ring: string
  route: LngLat[]
  start: LngLat
  /** Where the run ended, once the route has been drawn that far. */
  finish: LngLat | null
  /** The finish square's fill. */
  finishFill: string
  cursor: LngLat | null
}

function routeData(route: LngLat[]): FeatureCollection {
  return route.length > 1
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }] }
    : EMPTY
}

function pointData(at: LngLat | null): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: at ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } }] : [],
  }
}

function setOrAddSource(map: MapLibreMap, id: string, data: FeatureCollection): boolean {
  const source = map.getSource(id) as GeoJSONSource | undefined
  if (source) {
    source.setData(data)
    return false
  }
  map.addSource(id, { type: 'geojson', data })
  return true
}

/** The finish square's side and outline, in px: 13 across, so its corners show past the 14 px start dot it may sit under. */
const FINISH_SIDE = 13
const FINISH_RING = 2
const PIXEL_RATIO = 2

/**
 * The finish as the share card draws it (design review, Oct 2026): a dark
 * square ringed in white, told from the round start by its shape. MapLibre
 * has no square marker, so it is an icon, drawn here pixel by pixel.
 */
export function finishMarkImage(fill: string, ring: string): Image {
  const size = FINISH_SIDE * PIXEL_RATIO
  const edge = FINISH_RING * PIXEL_RATIO
  const [inner, outer] = [rgbTriplet(fill), rgbTriplet(ring)]
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const onRing = x < edge || y < edge || x >= size - edge || y >= size - edge
      const [r, g, b] = onRing ? outer : inner
      data.set([r!, g!, b!, 255], (y * size + x) * 4)
    }
  }
  return { width: size, height: size, data }
}

/**
 * The run on the Activity map (v4.17), in one call that can be made again
 * after a style change: the route as one accent line, width 4, directly under
 * the style's first label layer so place names draw over it; the start as an
 * accent dot ringed in white; the finish as a dark square, under the start
 * where a loop brings the two together; and the scrub's marker, a larger
 * accent dot that follows the Charts tab. The markers sit on top of
 * everything.
 */
export function addRunLayers(map: MapLibreMap, state: RunLayersState): void {
  const before = firstSymbolLayerId(map)
  if (setOrAddSource(map, ROUTE_SOURCE, routeData(state.route)) || !map.getLayer(ROUTE_LINE_LAYER)) {
    map.addLayer({
      id: ROUTE_LINE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': state.accent, 'line-width': 4 },
    }, before)
  }
  if (!map.hasImage(FINISH_MARK_ICON)) {
    map.addImage(FINISH_MARK_ICON, finishMarkImage(state.finishFill, state.ring), { pixelRatio: PIXEL_RATIO })
  }
  if (setOrAddSource(map, RUN_FINISH_SOURCE, pointData(state.finish)) || !map.getLayer(RUN_FINISH_LAYER)) {
    map.addLayer({
      id: RUN_FINISH_LAYER,
      type: 'symbol',
      source: RUN_FINISH_SOURCE,
      layout: { 'icon-image': FINISH_MARK_ICON, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    }, map.getLayer(RUN_START_LAYER) ? RUN_START_LAYER : undefined)
  }
  if (setOrAddSource(map, RUN_START_SOURCE, pointData(state.start)) || !map.getLayer(RUN_START_LAYER)) {
    map.addLayer({
      id: RUN_START_LAYER,
      type: 'circle',
      source: RUN_START_SOURCE,
      paint: { 'circle-radius': 5, 'circle-color': state.accent, 'circle-stroke-color': state.ring, 'circle-stroke-width': 2 },
    })
  }
  if (setOrAddSource(map, RUN_CURSOR_SOURCE, pointData(state.cursor)) || !map.getLayer(RUN_CURSOR_LAYER)) {
    map.addLayer({
      id: RUN_CURSOR_LAYER,
      type: 'circle',
      source: RUN_CURSOR_SOURCE,
      paint: { 'circle-radius': 7, 'circle-color': state.accent, 'circle-stroke-color': state.ring, 'circle-stroke-width': 3 },
    })
  }
}

/** The route drawn so far: the draw-in animation hands it a longer slice each frame. */
/** A new accent on the run's layers, without re-adding them (v4.17). */
export function setRunAccent(map: MapLibreMap, accent: string): void {
  if (map.getLayer(ROUTE_LINE_LAYER)) map.setPaintProperty(ROUTE_LINE_LAYER, 'line-color', accent)
  for (const id of [RUN_START_LAYER, RUN_CURSOR_LAYER]) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-color', accent)
}

export function setRunRoute(map: MapLibreMap, route: LngLat[]): void {
  ;(map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(routeData(route))
}

/** The finish, once the draw-in has reached it. */
export function setRunFinishMark(map: MapLibreMap, at: LngLat | null): void {
  ;(map.getSource(RUN_FINISH_SOURCE) as GeoJSONSource | undefined)?.setData(pointData(at))
}

/** The scrub's point on the route, or none. */
export function setRunCursor(map: MapLibreMap, at: LngLat | null): void {
  ;(map.getSource(RUN_CURSOR_SOURCE) as GeoJSONSource | undefined)?.setData(pointData(at))
}

/**
 * The point a share of the way along the route by distance, not by index:
 * GPS points come by time, so a slow stretch has more of them, and the
 * charts' samples are spread by distance.
 */
export function pointAlongRoute(route: readonly LngLat[], fraction: number): LngLat | null {
  if (route.length === 0) return null
  if (route.length === 1 || fraction <= 0) return route[0]!
  if (fraction >= 1) return route[route.length - 1]!
  const legs: number[] = []
  let total = 0
  for (let i = 1; i < route.length; i++) {
    const [lng1, lat1] = route[i - 1]!
    const [lng2, lat2] = route[i]!
    const leg = distanceKm(lng1, lat1, lng2, lat2)
    legs.push(leg)
    total += leg
  }
  if (total === 0) return route[0]!
  let left = Math.min(1, Math.max(0, fraction)) * total
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!
    if (left <= leg || i === legs.length - 1) {
      const k = leg > 0 ? Math.min(1, left / leg) : 0
      const [lng1, lat1] = route[i]!
      const [lng2, lat2] = route[i + 1]!
      return [lng1 + (lng2 - lng1) * k, lat1 + (lat2 - lat1) * k]
    }
    left -= leg
  }
  return route[route.length - 1]!
}

export function markerPoints(start: LngLat, finish: LngLat | null): FeatureCollection<Point> {
  const point = (coordinates: LngLat, icon: string) => ({
    type: 'Feature' as const,
    properties: { icon },
    geometry: { type: 'Point' as const, coordinates },
  })
  return { type: 'FeatureCollection', features: [point(start, START_ICON), ...(finish ? [point(finish, FINISH_ICON)] : [])] }
}

/**
 * Start and finish as a symbol layer on top of everything, not DOM markers
 * (v4.10): they are always drawn and take part in label placement, so a
 * place name that would touch one is dropped by MapLibre itself.
 */
export function addRunMarkers(map: MapLibreMap, start: LngLat, images: { start: Image; finish: Image }): void {
  if (!map.hasImage(START_ICON)) map.addImage(START_ICON, images.start, { pixelRatio: 2 })
  if (!map.hasImage(FINISH_ICON)) map.addImage(FINISH_ICON, images.finish, { pixelRatio: 2 })
  map.addSource(RUN_MARKERS_SOURCE, { type: 'geojson', data: markerPoints(start, null) })
  map.addLayer({
    id: RUN_MARKERS_LAYER,
    type: 'symbol',
    source: RUN_MARKERS_SOURCE,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
    },
  })
}

export function setRunFinish(map: MapLibreMap, start: LngLat, finish: LngLat | null): void {
  ;(map.getSource(RUN_MARKERS_SOURCE) as GeoJSONSource | undefined)?.setData(markerPoints(start, finish))
}

/** Every `step` px along the four edges of a w x h canvas. */
export function edgePoints(w: number, h: number, step = 16): [number, number][] {
  const points: [number, number][] = []
  for (let x = 0; x <= w; x += step) points.push([x, 0], [x, h])
  for (let y = step; y < h; y += step) points.push([0, y], [w, y])
  return points
}

/**
 * No label cut at the canvas edge (v4.10). MapLibre draws a name that runs
 * past the edge; an invisible icon every 16 px along it, placed above the
 * labels, makes such a name collide and be dropped instead. The fence
 * follows the view as it moves. Returns the cleanup.
 */
export function addEdgeFence(map: MapLibreMap): () => void {
  const size = 24
  if (!map.hasImage(FENCE_ICON)) {
    map.addImage(FENCE_ICON, { width: size, height: size, data: new Uint8Array(size * size * 4) })
  }
  map.addSource(EDGE_FENCE_SOURCE, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: EDGE_FENCE_LAYER,
    type: 'symbol',
    source: EDGE_FENCE_SOURCE,
    layout: { 'icon-image': FENCE_ICON, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
  })

  function update() {
    const canvas = map.getCanvas()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const features = edgePoints(w, h).map(([x, y]) => {
      const { lng, lat } = map.unproject([x, y])
      return { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [lng, lat] } }
    })
    ;(map.getSource(EDGE_FENCE_SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })
  }

  update()
  map.on('moveend', update)
  map.on('resize', update)
  return () => {
    map.off('moveend', update)
    map.off('resize', update)
  }
}

/** A clear square the size of a marker: collision without paint, for maps whose markers are drawn elsewhere. */
export function clearMarkerImage(diameter = 13): Image {
  const size = (diameter + 2) * 2
  return { width: size, height: size, data: new Uint8Array(size * size * 4) }
}
