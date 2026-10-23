'use client'

import { useEffect, useState } from 'react'
import { maptilerStyle, shareBasemapStyle } from '@/lib/maptiler'
import { bandFencePoints, routeFencePoints, simplifyRoute, type LngLat, type RouteFrame } from '@/lib/shareCardMap'
import type { ThemeMode } from '@/lib/shareCardPalette'
import { addLandmarkLabels, addParkLabels, addWaterLabels, isPlaceLabelLayer, loadMapLibre, showPlacesAtAnyZoom, styleRunMapLabels } from '@/lib/maplibre'
import type { ShareMapLabel } from '@/lib/shareCardDraw'
import { SURFACES } from '@/lib/themeTokens'
import { t } from '@/i18n'
import { addEdgeFence, addRunMarkers, clearMarkerImage, setRunFinish } from '@/lib/runMapLayers'

export interface ShareCardMap {
  image: HTMLCanvasElement | null
  points: [number, number][] | null
  labels: ShareMapLabel[] | null
  failed: boolean
}

interface Render {
  image: HTMLCanvasElement
  points: [number, number][]
  labels: ShareMapLabel[]
}

export interface ShareCardMapOptions {
  route: LngLat[] | null | undefined
  theme: ThemeMode
  /** The whole card: the map runs under the header and the stats. */
  width: number
  height: number
  /** The route's room, clear of the header's words and the stats. */
  frame: RouteFrame
  /** Where the header's and the stats' bands meet the map: no name is cut by either. */
  bands: readonly number[]
  enabled?: boolean
}

// A phone's own ratio, not 4: at 4 the basemap goes missing from the card on a phone.
const PIXEL_RATIO = 3

const RENDER_TIMEOUT_MS = 15_000

const DISTRICT_OPACITY = { light: 0.7, dark: 0.8 } as const
const WATER_INK = { light: '#5f7f9a', dark: '#5b7d99' } as const
const PARK_INK = { light: '#5e7f65', dark: '#5f8a6d' } as const
const LANDMARK_INK = { light: '#7d6f8c', dark: '#9a8ca8' } as const
/** The card's map is 300 px wide: its names sit a step under the app's. */
const CARD_LABEL_SIZE = 10
const MAP_LANG = t.locale.split('-')[0] ?? 'en'

/**
 * A tile, glyph or sprite that fails to load is only logged: MapLibre draws
 * the rest and still goes idle. Only a map that never settles fails.
 */
function settled(map: import('maplibre-gl').Map, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('basemap render timed out')), timeoutMs)
    map.on('error', (e) => console.warn('Share card basemap:', e.error?.message ?? e))
    map.once('idle', () => { clearTimeout(timer); resolve() })
  })
}

interface RenderOptions {
  route: LngLat[]
  theme: ThemeMode
  width: number
  height: number
  frame: RouteFrame
  bands: readonly number[]
}

const LABEL_FENCE_SOURCE = 'share-label-fence'
const LABEL_FENCE_LAYER = 'share-label-fence'
const LABEL_FENCE_ICON = 'share-label-fence'
/**
 * As wide as the 3 px trace and its casing, no wider: a wider icon reaches a
 * name's own point and drops every district the run went through.
 */
const LABEL_FENCE_PX = 6

/**
 * The route is painted on the card afterwards, so clear icons along it and
 * along the bands' edges make MapLibre drop a name that would sit on the
 * line or be cut by a band.
 */
function fenceLabels(map: import('maplibre-gl').Map, points: LngLat[], width: number, bands: readonly number[]) {
  const screen = points.map((c): [number, number] => { const p = map.project(c); return [p.x, p.y] })
  const features = [...routeFencePoints(screen), ...bandFencePoints(width, bands)].map(([x, y]) => {
    const { lng, lat } = map.unproject([x, y])
    return { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [lng, lat] } }
  })
  const size = LABEL_FENCE_PX
  if (!map.hasImage(LABEL_FENCE_ICON)) map.addImage(LABEL_FENCE_ICON, { width: size, height: size, data: new Uint8Array(size * size * 4) })
  map.addSource(LABEL_FENCE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features } })
  map.addLayer({
    id: LABEL_FENCE_LAYER,
    type: 'symbol',
    source: LABEL_FENCE_SOURCE,
    layout: { 'icon-image': LABEL_FENCE_ICON, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
  })
}

function placeLayerIds(map: import('maplibre-gl').Map): string[] {
  return map.getStyle().layers.filter((layer) => isPlaceLabelLayer(layer as { id: string; type: string; 'source-layer'?: string })).map((layer) => layer.id)
}

function placedLabels(map: import('maplibre-gl').Map, mode: ThemeMode): ShareMapLabel[] {
  const ids = placeLayerIds(map)
  if (ids.length === 0) return []
  const surface = SURFACES[mode]
  const seen = new Set<string>()
  const out: ShareMapLabel[] = []
  for (const feature of map.queryRenderedFeatures({ layers: ids })) {
    const props = feature.properties ?? {}
    const text = String(props[`name:${MAP_LANG}`] ?? props.name ?? '').trim()
    if (!text || seen.has(text) || feature.geometry.type !== 'Point') continue
    seen.add(text)
    const id = feature.layer.id
    const size = Number(map.getLayoutProperty(id, 'text-size')) || CARD_LABEL_SIZE
    const opacity = Number(map.getPaintProperty(id, 'text-opacity'))
    const { x, y } = map.project(feature.geometry.coordinates as [number, number])
    out.push({ text, x, y, size, color: surface.text2, opacity: Number.isFinite(opacity) ? opacity : 1 })
  }
  return out
}

async function renderRouteMap(opts: RenderOptions): Promise<Render> {
  const { route, theme, width, height, frame, bands } = opts
  const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!token) throw new Error('NEXT_PUBLIC_MAPTILER_TOKEN not set')

  const mgl = await loadMapLibre()
  const points = simplifyRoute(route)
  const first = points[0]
  if (!first) throw new Error('empty route')
  const isDark = theme === 'dark'

  const container = document.createElement('div')
  Object.assign(container.style, {
    // Off screen on both axes: nothing fixed sits at the top edge.
    position: 'fixed', left: '-10000px', top: '-10000px',
    width: `${width}px`, height: `${height}px`, pointerEvents: 'none',
  })
  document.body.appendChild(container)

  const bounds = points.reduce((b, c) => b.extend(c), new mgl.LngLatBounds(first, first))
  const map = new mgl.Map({
    container,
    style: shareBasemapStyle(maptilerStyle(isDark, token), isDark),
    bounds,
    fitBoundsOptions: { padding: frame, maxZoom: 15, duration: 0 },
    canvasContextAttributes: { preserveDrawingBuffer: true },
    pixelRatio: PIXEL_RATIO,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
  })

  // The card paints the route and markers on top afterwards, so clear icons
  // stand in for them here: a name under one, or cut by an edge, is dropped.
  const surface = SURFACES[isDark ? 'dark' : 'light']
  map.on('load', () => {
    styleRunMapLabels(map, { halo: surface.background, town: surface.text2, neighbourhood: surface.text2, districtOpacity: DISTRICT_OPACITY[theme] })
    addParkLabels(map, { halo: surface.background, park: PARK_INK[theme], size: CARD_LABEL_SIZE, lang: MAP_LANG })
    addLandmarkLabels(map, { halo: surface.background, landmark: LANDMARK_INK[theme], size: CARD_LABEL_SIZE, lang: MAP_LANG })
    addWaterLabels(map, { halo: surface.background, water: WATER_INK[theme], size: CARD_LABEL_SIZE, lang: MAP_LANG })
    showPlacesAtAnyZoom(map, { districtOpacity: DISTRICT_OPACITY[theme] })
    addRunMarkers(map, first, { start: clearMarkerImage(), finish: clearMarkerImage() })
    const last = points[points.length - 1]
    if (last && last !== first) setRunFinish(map, first, last)
    addEdgeFence(map)
    fenceLabels(map, points, width, bands)
    // Places above the fence are placed first, so the line drops none of them.
    for (const id of placeLayerIds(map)) map.moveLayer(id)
  })

  try {
    await settled(map, RENDER_TIMEOUT_MS)

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    // Read where MapLibre placed each name, then capture the map without
    // them: the card paints its route over the map, and the names over that.
    const labels = placedLabels(map, isDark ? 'dark' : 'light')
    if (labels.length > 0) {
      for (const id of placeLayerIds(map)) map.setLayoutProperty(id, 'visibility', 'none')
      await settled(map, RENDER_TIMEOUT_MS)
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }

    const src = map.getCanvas()
    const image = document.createElement('canvas')
    image.width = src.width
    image.height = src.height
    image.getContext('2d')?.drawImage(src, 0, 0)

    return { image, points: points.map((c) => { const p = map.project(c); return [p.x, p.y] }), labels }
  } finally {
    map.remove()
    container.remove()
  }
}

const rendered = new Map<string, Render>()
const inFlight = new Map<string, Promise<Render>>()

function cacheKey(route: LngLat[], theme: ThemeMode, w: number, h: number, frame: RouteFrame): string {
  const pts = simplifyRoute(route)
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${pts.length}:${first}:${last}:${theme}:${w}x${h}:${frame.top},${frame.right},${frame.bottom},${frame.left}`
}

export function useShareCardMap({
  route, theme, width, height, frame, bands, enabled = true,
}: ShareCardMapOptions): ShareCardMap {
  const wanted = enabled && !!route && route.length > 1
  // The bands follow the frame: the key holds both.
  const key = wanted ? cacheKey(route!, theme, width, height, frame) : null
  const [, bump] = useState(0)
  // A failed map is this sheet's, not the session's: the next sheet tries again.
  const [failedKey, setFailedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!key || !route || rendered.has(key)) return
    let alive = true
    let pending = inFlight.get(key)
    if (!pending) {
      pending = renderRouteMap({ route, theme, width, height, frame, bands })
      pending.catch(() => {})
      inFlight.set(key, pending)
    }
    pending
      .then((r) => { rendered.set(key, r); if (alive) bump(n => n + 1) })
      .catch(() => { if (alive) setFailedKey(key) })
      .finally(() => inFlight.delete(key))
    return () => { alive = false }
    // key encodes route, theme, size and frame; listing the arrays would
    // re-render the map on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const hit = key ? rendered.get(key) : undefined
  return {
    image: hit?.image ?? null,
    points: hit?.points ?? null,
    labels: hit?.labels ?? null,
    failed: !!key && failedKey === key,
  }
}
