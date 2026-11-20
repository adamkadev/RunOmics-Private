'use client'

import { useEffect, useState } from 'react'
import { maptilerStyle, shareBasemapStyle } from '@/lib/maptiler'
import {
  bandFencePoints, pickWater, routeFencePoints, simplifyRoute,
  type LngLat, type RouteFrame, type WaterLine,
} from '@/lib/shareCardMap'
import { W, type ThemeMode } from '@/lib/shareCardPalette'
import {
  addLandmarkLabels, addParkLabels, addWaterLabels, isPlaceLabelLayer, loadMapLibre, PARK_LABEL_LAYER, showPlacesAtAnyZoom,
  styleRunMapLabels, WATER_LABEL_LAYER,
} from '@/lib/maplibre'
import { LABEL_PRIORITY, labelDebug, shareMarkerRadius, type ShareMapLabel } from '@/lib/shareCardDraw'
import {
  areaLimit, passedAreas, PLACE_LEVELS, sameArea, type PlaceLevel, type TilePlace,
} from '@/lib/shareCardPlaces'
import {
  areaAt as areaOf, featureName, geocodedAt, MAP_LANG, metresPerPx, routeGreenName, sourceOf, tilePlaces, type Px, type RouteNamesContext,
} from '@/lib/runMapNames'
import { SHARE_MARKER_HEX } from '@/lib/shareCardPalette'
import { endsJoined, MARKER_CLEARANCE } from '@/lib/routeMarkers'
import { SURFACES } from '@/lib/themeTokens'
import { famousLimit, findFamousPlaces } from '@/lib/famousPlaces'
import { addEdgeFence, addRunMarkers, clearMarkerImage, setRunFinish } from '@/lib/runMapLayers'

export interface ShareCardMap {
  image: HTMLCanvasElement | null
  points: [number, number][] | null
  labels: ShareMapLabel[] | null
  /** The town the start is in, from the same lookup as its label, so the subtitle and the map agree. */
  place: string | null
  failed: boolean
}

interface Render {
  image: HTMLCanvasElement
  points: [number, number][]
  labels: ShareMapLabel[]
  place: string | null
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

// The export is 1080 px wide, so a map drawn narrower is stretched and soft.
const EXPORT_RATIO = 1080 / W
// At 4 the basemap went missing on a phone, and a story at 3 (900 x 1600) draws: a portrait at full size is about as many pixels.
const MAX_MAP_PIXELS = 1080 * 1350

export function mapPixelRatio(width: number, height: number): number {
  return Math.min(EXPORT_RATIO, Math.max(3, Math.sqrt(MAX_MAP_PIXELS / (width * height))))
}

const RENDER_TIMEOUT_MS = 15_000

const DISTRICT_OPACITY = { light: 0.7, dark: 0.8 } as const
const WATER_INK = { light: '#5f7f9a', dark: '#5b7d99' } as const
const PARK_INK = { light: '#5e7f65', dark: '#5f8a6d' } as const
const LANDMARK_INK = { light: '#6f7472', dark: '#a3a9a7' } as const
/** The card's map is 300 px wide: its names sit a step under the app's. */
const CARD_LABEL_SIZE = 10

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

const WATER_SOURCE_LAYER = 'water_label'

function lineParts(geometry: GeoJSON.Geometry): LngLat[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates as LngLat[]]
  if (geometry.type === 'MultiLineString') return geometry.coordinates as LngLat[][]
  return []
}

/** Area names further apart than this, so the card does not stack them. */
const AREA_SPACING_PX = 60

interface LabelContext extends RouteNamesContext {
  mode: ThemeMode
  /** The route on the ground, for what lies within metres of it. */
  path: LngLat[]
}

/** Chooses the card's names: the start's area, the finish's, the famous places, the landmark, the water, then the areas passed. */
async function routeLabels(context: LabelContext): Promise<{ labels: ShareMapLabel[]; place: string | null }> {
  const { map, route, mode, token, project } = context
  const surface = SURFACES[mode]
  const areaStyle = (level: PlaceLevel) => ({ size: CARD_LABEL_SIZE, color: surface.text2, opacity: level === 'city' ? 1 : DISTRICT_OPACITY[mode] })
  const start = route[0]!
  const finish = route[route.length - 1]!
  const joined = endsJoined(start, finish)
  const places = tilePlaces(map, project)
  const mPerPx = metresPerPx(map, start)
  const labels: ShareMapLabel[] = []

  const areaAt = (at: Px) => areaOf(context, places, mPerPx, at)
  const startArea = await areaAt(start)
  const place = (await geocodedAt(map, start, token, project)).find((g) => g.level === 'city' && g.contains)?.name ?? null
  if (startArea) labels.push({ text: startArea.name, x: start[0], y: start[1], kind: 'start', priority: LABEL_PRIORITY.start, ...areaStyle(startArea.level) })
  else console.warn('Share card: no area found at the start')
  labelDebug('start area', startArea, `${places.length} tile places`)

  if (!joined) {
    const finishArea = await areaAt(finish)
    if (finishArea && !(startArea && sameArea(finishArea.name, startArea.name))) {
      labels.push({ text: finishArea.name, x: finish[0], y: finish[1], kind: 'finish', priority: LABEL_PRIORITY.finish, ...areaStyle(finishArea.level) })
    }
  }

  for (const famous of await findFamousPlaces(map, context.path, token, famousLimit(context.path))) {
    if (labels.some((l) => sameArea(l.text, famous.name))) continue
    const [x, y] = project(famous.at)
    labels.push({ text: famous.name, x, y, size: CARD_LABEL_SIZE, color: LANDMARK_INK[mode], opacity: 1, priority: LABEL_PRIORITY.famous, kind: 'famous' })
  }

  const landmark = await routeLandmark(context, places, mPerPx, joined, labels.map((l) => l.text))
  if (landmark) labels.push(landmark)

  const water = routeWater(map, route, project)
  if (water && !(landmark && sameArea(water.name, landmark.text))) {
    labels.push({ text: water.name, x: water.at[0], y: water.at[1], size: CARD_LABEL_SIZE, color: WATER_INK[mode], opacity: 1, priority: LABEL_PRIORITY.water, kind: 'water' })
  }

  const named = labels.map((l) => l.text)
  for (const area of passedAreas(route, places, mPerPx, { exclude: named, limit: areaLimit(route, mPerPx), spacingPx: AREA_SPACING_PX })) {
    labels.push({ text: area.name, x: area.at[0], y: area.at[1], kind: 'area', priority: LABEL_PRIORITY.area, ...areaStyle(area.level) })
  }
  if (labels.length < 2) {
    const [fallback] = passedAreas(route, places, mPerPx, { exclude: named, limit: 1, levels: PLACE_LEVELS })
    if (fallback) labels.push({ text: fallback.name, x: fallback.at[0], y: fallback.at[1], kind: 'area', priority: LABEL_PRIORITY.area, ...areaStyle(fallback.level) })
    else console.warn('Share card: one place name only, nothing else found along the route')
  }
  labelDebug('candidates', labels.map((l) => `${l.text} (${l.kind})`), 'town', place)
  return { labels, place }
}

/** The green holding most of the route, by name, else the locality it lies in. */
async function routeLandmark(
  context: LabelContext, places: readonly TilePlace[], mPerPx: number, joined: boolean, named: readonly string[],
): Promise<ShareMapLabel | null> {
  const { route, mode } = context
  const green = await routeGreenName(context, mPerPx, joined)
  if (green.found) return { text: green.name, x: green.at[0], y: green.at[1], size: CARD_LABEL_SIZE, color: PARK_INK[mode], opacity: 1, priority: LABEL_PRIORITY.landmark, kind: 'landmark' }
  if (green.reason === 'no green') {
    labelDebug('landmark: no green holds enough of the route')
    return null
  }
  const [locality] = passedAreas(route, places, mPerPx, { exclude: named, limit: 1, levels: PLACE_LEVELS })
  labelDebug('landmark: no name for the green, locality', locality?.name ?? 'none')
  return locality
    ? { text: locality.name, x: locality.at[0], y: locality.at[1], size: CARD_LABEL_SIZE, color: SURFACES[mode].text2, opacity: DISTRICT_OPACITY[mode], priority: LABEL_PRIORITY.landmark, kind: 'area' }
    : null
}

function routeWater(map: import('maplibre-gl').Map, route: Px[], project: (c: LngLat) => Px): { name: string; at: Px } | null {
  const waterSource = sourceOf(map, WATER_SOURCE_LAYER)
  const byName = new Map<string, WaterLine>()
  for (const f of waterSource ? map.querySourceFeatures(waterSource, { sourceLayer: WATER_SOURCE_LAYER }) : []) {
    const name = featureName(f.properties)
    if (!name || !['river', 'canal'].includes(String(f.properties?.class))) continue
    const entry = byName.get(name) ?? { name, lines: [] }
    entry.lines.push(...lineParts(f.geometry).map((line) => line.map(project)))
    byName.set(name, entry)
  }
  return pickWater(route, [...byName.values()])
}

/** The card draws these names itself: the map must not draw them a second time. */
function hideFromMap(map: import('maplibre-gl').Map, names: string[]) {
  if (names.length === 0) return
  const notNamed = ['!', ['in', ['coalesce', ['get', `name:${MAP_LANG}`], ['get', 'name']], ['literal', names]]]
  for (const id of [PARK_LABEL_LAYER, WATER_LABEL_LAYER]) {
    if (!map.getLayer(id)) continue
    map.setFilter(id, ['all', map.getFilter(id) ?? true, notNamed] as unknown as Parameters<typeof map.setFilter>[1])
  }
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
    pixelRatio: mapPixelRatio(width, height),
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
    const fence = (kind: 'start' | 'finish') => clearMarkerImage(shareMarkerRadius(kind, { markerOutline: SHARE_MARKER_HEX[theme].outline }) + MARKER_CLEARANCE)
    addRunMarkers(map, first, { start: fence('start'), finish: fence('finish') })
    const last = points[points.length - 1]
    if (last && last !== first) setRunFinish(map, first, last)
    addEdgeFence(map)
    fenceLabels(map, points, width, bands)
    // The card draws the place names itself, from the tiles: the map shows none.
    for (const id of placeLayerIds(map)) map.setLayoutProperty(id, 'visibility', 'none')
  })

  try {
    await settled(map, RENDER_TIMEOUT_MS)

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const mode = isDark ? 'dark' : 'light'
    const project = (c: LngLat): Px => { const p = map.project(c); return [p.x, p.y] }
    const screen = points.map(project)
    const { labels, place } = await routeLabels({ map, route: screen, path: points, mode, token, project, room: [frame.left, frame.top, width - frame.right, height - frame.bottom] })
    const drawnByCard = labels.filter((l) => l.kind === 'landmark' || l.kind === 'water').map((l) => l.text)
    if (drawnByCard.length > 0) {
      hideFromMap(map, drawnByCard)
      await settled(map, RENDER_TIMEOUT_MS)
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }

    const src = map.getCanvas()
    const image = document.createElement('canvas')
    image.width = src.width
    image.height = src.height
    image.getContext('2d')?.drawImage(src, 0, 0)

    return { image, points: screen, labels, place }
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
    place: hit?.place ?? null,
    failed: !!key && failedKey === key,
  }
}
