import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { distanceKm } from '@/lib/math'
import { JOIN_PX as JOIN_DISTANCE_PX, markerExtent, routeEnds, routeMarkerImage } from '@/lib/routeMarkers'

export const ROUTE_SOURCE = 'route'
export const ROUTE_LINE_LAYER = 'route-line'
export const ROUTE_HALO_LAYER = 'route-halo'
export const ROUTE_LABEL_GUARD_LAYER = 'route-label-guard'
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
  /**
   * The ring round the start and the scrub marker, and the route's halo:
   * the page ground (3.0), so the line and its dots lift off the tiles.
   */
  ring: string
  route: LngLat[]
  start: LngLat
  /** Where the run ended - the drawn line's own last point - once the route has been drawn that far. */
  finish: LngLat | null
  /** Whether start and finish sit under 20 px apart at the current zoom: one loop marker then. */
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

/** The ends as features: the start alone, or the finish or loop marker (routeMarkers). */
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
 * No place name under the route (3.0 handoff: "Metz" sat under the line).
 * MapLibre never tests a label against a line, so an invisible icon every
 * 12 px along the route, placed above the labels, makes a name that would
 * cross it collide and be dropped. It reads the route's own source, so it
 * follows the draw-in. Names clear of the line stay.
 */
export function addRouteLabelGuard(map: MapLibreMap, source: string): void {
  addClearIcon(map)
  if (map.getLayer(ROUTE_LABEL_GUARD_LAYER)) return
  map.addLayer({
    id: ROUTE_LABEL_GUARD_LAYER,
    type: 'symbol',
    source,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 12,
      'icon-image': FENCE_ICON,
      'icon-size': 0.5,
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
      'icon-rotation-alignment': 'map',
    },
  })
}

/**
 * The run on the Activity map (v4.17), in one call that can be made again
 * after a style change: the route as one accent line, width 4, on a 3 px
 * halo in the page ground (3.0), over the style's place names (design
 * review, Oct 2026: a label used to sit over the finish), with no name left
 * under it (addRouteLabelGuard); the start as a 7 px accent dot in a 2.5 px
 * ring of the ground; the finish
 * as the checkered dot of routeMarkers on the line's last point, or one
 * loop marker on the start where the two would touch; and the scrub's
 * marker, a larger accent dot that follows the Charts tab, on top.
 */
export function addRunLayers(map: MapLibreMap, state: RunLayersState): void {
  const newSource = setOrAddSource(map, ROUTE_SOURCE, routeData(state.route))
  if (newSource || !map.getLayer(ROUTE_HALO_LAYER)) {
    map.addLayer({
      id: ROUTE_HALO_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': state.ring, 'line-width': 10 },
    })
  }
  if (newSource || !map.getLayer(ROUTE_LINE_LAYER)) {
    map.addLayer({
      id: ROUTE_LINE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': state.accent, 'line-width': 4 },
    })
  }
  addRouteLabelGuard(map, ROUTE_SOURCE)
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
    // A 7 px dot, the 2.5 px ring drawn outside it (3.0).
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

/** A new accent on the run's layers, without re-adding them (v4.17); the loop marker's ring is in it. */
export function setRunAccent(map: MapLibreMap, accent: string): void {
  if (map.getLayer(ROUTE_LINE_LAYER)) map.setPaintProperty(ROUTE_LINE_LAYER, 'line-color', accent)
  for (const id of [RUN_START_LAYER, RUN_CURSOR_LAYER]) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-color', accent)
  if (map.hasImage(LOOP_MARK_ICON)) map.updateImage(LOOP_MARK_ICON, routeMarkerImage('loop', accent, ICON_PIXEL_RATIO))
}

/** Whether the ends' centres sit under 20 px apart at the map's current zoom. */
export function runEndsJoined(map: Pick<MapLibreMap, 'project'>, start: LngLat, finish: LngLat): boolean {
  const a = map.project(start)
  const b = map.project(finish)
  return Math.hypot(b.x - a.x, b.y - a.y) < JOIN_DISTANCE_PX
}

export function setRunRoute(map: MapLibreMap, route: LngLat[]): void {
  ;(map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(routeData(route))
}

/** The ends as they now stand: the finish once the draw-in has reached it, joined into one marker on a loop. */
export function setRunEnds(map: MapLibreMap, start: LngLat, finish: LngLat | null, joined: boolean): void {
  const ends = endsData(start, finish, joined)
  ;(map.getSource(RUN_START_SOURCE) as GeoJSONSource | undefined)?.setData(ends.start)
  ;(map.getSource(RUN_FINISH_SOURCE) as GeoJSONSource | undefined)?.setData(ends.marks)
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

/** A clear square the size of the largest marker: collision without paint, for maps whose markers are drawn elsewhere. */
export function clearMarkerImage(diameter = markerExtent('loop')): Image {
  const size = (diameter + 2) * 2
  return { width: size, height: size, data: new Uint8Array(size * size * 4) }
}
