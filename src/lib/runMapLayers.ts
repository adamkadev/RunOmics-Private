import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { distanceKm } from '@/lib/math'
import { firstSymbolLayerId } from '@/lib/maplibre'
import { JOIN_PX as JOIN_DISTANCE_PX, markerExtent, routeEnds, routeMarkerImage } from '@/lib/routeMarkers'
import { MAP_PADDING } from './routeFrame'

export const ROUTE_SOURCE = 'route'
export const ROUTE_LINE_LAYER = 'route-line'
export const ROUTE_HALO_LAYER = 'route-halo'
export const RUN_START_SOURCE = 'run-start-dot'
export const RUN_START_LAYER = 'run-start-dot'
export const RUN_FINISH_SOURCE = 'run-finish-mark'
export const RUN_FINISH_LAYER = 'run-finish-mark'
export const FINISH_MARK_ICON = 'run-finish-mark'
export const LOOP_MARK_ICON = 'run-loop-mark'
export const RUN_CURSOR_SOURCE = 'run-cursor'
export const RUN_CURSOR_LAYER = 'run-cursor'
export const RUN_MARKERS_SOURCE = 'run-start-finish'
export const RUN_MARKERS_LAYER = 'run-start-finish'
export const EDGE_FENCE_SOURCE = 'map-edge-fence'
export const EDGE_FENCE_LAYER = 'map-edge-fence'
export const START_ICON = 'run-start'
export const FINISH_ICON = 'run-finish'
const FENCE_ICON = 'map-edge-fence'

export const ROUTE_FIT_PADDING = MAP_PADDING.hero

type LngLat = [number, number]
type Image = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export interface RunLayersState {
  /** The accent, as a literal colour: MapLibre paints values, not CSS variables. */
  accent: string
  /** The page ground, so the line and its dots lift off the tiles. */
  ring: string
  route: LngLat[]
  start: LngLat
  /** Null until the draw-in reaches the end. */
  finish: LngLat | null
  joined: boolean
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

const ICON_PIXEL_RATIO = 2

function endsData(start: LngLat, finish: LngLat | null, joined: boolean) {
  const ends = routeEnds(start, finish, joined)
  const startAt = ends.find((end) => end.kind === 'start')?.at ?? null
  const mark = ends.find((end) => end.kind !== 'start')
  const icon = mark?.kind === 'loop' ? LOOP_MARK_ICON : FINISH_MARK_ICON
  const marks: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: mark ? [{ type: 'Feature', properties: { icon }, geometry: { type: 'Point', coordinates: mark.at } }] : [],
  }
  return { start: pointData(startAt), marks }
}

/** A clear square: collision without paint. */
function addClearIcon(map: MapLibreMap): void {
  const size = 24
  if (!map.hasImage(FENCE_ICON)) {
    map.addImage(FENCE_ICON, { width: size, height: size, data: new Uint8Array(size * size * 4) })
  }
}

/**
 * Can be called again after a style change. The route goes under the style's
 * labels, so every name stays, drawn over the line on its own halo.
 */
export function addRunLayers(map: MapLibreMap, state: RunLayersState): void {
  const newSource = setOrAddSource(map, ROUTE_SOURCE, routeData(state.route))
  const underLabels = firstSymbolLayerId(map)
  if (newSource || !map.getLayer(ROUTE_HALO_LAYER)) {
    map.addLayer({
      id: ROUTE_HALO_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': state.ring, 'line-width': 10 },
    }, underLabels)
  }
  if (newSource || !map.getLayer(ROUTE_LINE_LAYER)) {
    map.addLayer({
      id: ROUTE_LINE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': state.accent, 'line-width': 4 },
    }, underLabels)
  }
  if (!map.hasImage(FINISH_MARK_ICON)) {
    map.addImage(FINISH_MARK_ICON, routeMarkerImage('finish', state.accent, ICON_PIXEL_RATIO), { pixelRatio: ICON_PIXEL_RATIO })
  }
  if (!map.hasImage(LOOP_MARK_ICON)) {
    map.addImage(LOOP_MARK_ICON, routeMarkerImage('loop', state.accent, ICON_PIXEL_RATIO), { pixelRatio: ICON_PIXEL_RATIO })
  }
  const ends = endsData(state.start, state.finish, state.joined)
  if (setOrAddSource(map, RUN_FINISH_SOURCE, ends.marks) || !map.getLayer(RUN_FINISH_LAYER)) {
    map.addLayer({
      id: RUN_FINISH_LAYER,
      type: 'symbol',
      source: RUN_FINISH_SOURCE,
      layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    })
  }
  if (setOrAddSource(map, RUN_START_SOURCE, ends.start) || !map.getLayer(RUN_START_LAYER)) {
    map.addLayer({
      id: RUN_START_LAYER,
      type: 'circle',
      source: RUN_START_SOURCE,
      paint: { 'circle-radius': 7, 'circle-color': state.accent, 'circle-stroke-color': state.ring, 'circle-stroke-width': 2.5 },
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

/** The loop marker's ring is in the accent, so its image is redrawn too. */
export function setRunAccent(map: MapLibreMap, accent: string): void {
  if (map.getLayer(ROUTE_LINE_LAYER)) map.setPaintProperty(ROUTE_LINE_LAYER, 'line-color', accent)
  for (const id of [RUN_START_LAYER, RUN_CURSOR_LAYER]) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-color', accent)
  if (map.hasImage(LOOP_MARK_ICON)) map.updateImage(LOOP_MARK_ICON, routeMarkerImage('loop', accent, ICON_PIXEL_RATIO))
}

export function runEndsJoined(map: Pick<MapLibreMap, 'project'>, start: LngLat, finish: LngLat): boolean {
  const a = map.project(start)
  const b = map.project(finish)
  return Math.hypot(b.x - a.x, b.y - a.y) < JOIN_DISTANCE_PX
}

export function setRunRoute(map: MapLibreMap, route: LngLat[]): void {
  ;(map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(routeData(route))
}

export function setRunEnds(map: MapLibreMap, start: LngLat, finish: LngLat | null, joined: boolean): void {
  const ends = endsData(start, finish, joined)
  ;(map.getSource(RUN_START_SOURCE) as GeoJSONSource | undefined)?.setData(ends.start)
  ;(map.getSource(RUN_FINISH_SOURCE) as GeoJSONSource | undefined)?.setData(ends.marks)
}

export function setRunCursor(map: MapLibreMap, at: LngLat | null): void {
  ;(map.getSource(RUN_CURSOR_SOURCE) as GeoJSONSource | undefined)?.setData(pointData(at))
}

/** By distance, not by index: GPS points come by time, and the charts' samples are spread by distance. */
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

/** A symbol layer, not DOM markers: they take part in label placement, so MapLibre drops a name that would touch one. */
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

export function edgePoints(w: number, h: number, step = 16): [number, number][] {
  const points: [number, number][] = []
  for (let x = 0; x <= w; x += step) points.push([x, 0], [x, h])
  for (let y = step; y < h; y += step) points.push([0, y], [w, y])
  return points
}

/**
 * MapLibre draws a name that runs past the canvas edge; an invisible icon
 * every 16 px along it, placed above the labels, makes such a name collide and
 * be dropped instead.
 */
export function addEdgeFence(map: MapLibreMap): () => void {
  addClearIcon(map)
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

/** Collision without paint, for maps whose markers are drawn elsewhere. */
export function clearMarkerImage(diameter = markerExtent('loop')): Image {
  const size = (diameter + 2) * 2
  return { width: size, height: size, data: new Uint8Array(size * size * 4) }
}
