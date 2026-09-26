import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { firstSymbolLayerId } from '@/lib/maplibre'

export const ROUTE_SOURCE = 'route'
export const ROUTE_CASING_LAYER = 'route-bg'
export const ROUTE_LINE_LAYER = 'route-line'
export const RUN_MARKERS_SOURCE = 'run-start-finish'
export const RUN_MARKERS_LAYER = 'run-start-finish'
export const EDGE_FENCE_SOURCE = 'map-edge-fence'
export const EDGE_FENCE_LAYER = 'map-edge-fence'
export const START_ICON = 'run-start'
export const FINISH_ICON = 'run-finish'
const FENCE_ICON = 'map-edge-fence'

/** The route fitted clear of the edges, a little more at the top for the expand button (v4.10). */
export const ROUTE_FIT_PADDING = { top: 32, right: 24, bottom: 24, left: 24 } as const

type LngLat = [number, number]
type Image = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * The casing and the pace-coloured line, directly under the style's first
 * label layer: place names draw over the route, their halo keeping them
 * readable where the line crosses them.
 */
export function addRouteLayers(map: MapLibreMap, { casing, lineColor }: { casing: string; lineColor: unknown }): void {
  const before = firstSymbolLayerId(map)
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: ROUTE_CASING_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': casing, 'line-width': 7, 'line-opacity': 0.85 },
  }, before)
  map.addLayer({
    id: ROUTE_LINE_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': lineColor as never, 'line-width': 4 },
  }, before)
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

/** A round marker drawn at 2x: `fill` inside a `ring`, 13 px across like the old DOM marker. */
export function markerImage(fill: string, ring: string, diameter = 13, ringWidth = 2): Image | null {
  const scale = 2
  const size = (diameter + 2) * scale
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const r = (diameter / 2) * scale
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, r - (ringWidth * scale) / 2, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = ringWidth * scale
  ctx.strokeStyle = ring
  ctx.stroke()
  const { data } = ctx.getImageData(0, 0, size, size)
  return { width: size, height: size, data }
}
