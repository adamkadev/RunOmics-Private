import type { Map as MapLibreMap } from 'maplibre-gl'

/** Where scripts/copy-maplibre-worker.mjs puts it: a path per version, so it is cached as immutable. */
export const workerUrl = (version: string) => `/maplibre/${version}/maplibre-gl-worker.mjs`

export type MapLibre = typeof import('maplibre-gl')

type StyleLayer = { id: string; type: string; 'source-layer'?: string; filter?: unknown }

/** OpenMapTiles and the older Planet v4 schemas. */
const PLACE_SOURCE_LAYERS = ['place', 'city_label', 'town_label', 'place_label']
const PLACE_LAYER_ID = /\b(place|city|town|village|suburb|neighbou?rhood|hamlet|quarter|locality)\b/i
const NEIGHBOURHOOD_LAYER_ID = /\b(suburb|neighbou?rhood|hamlet|quarter|isolated)\b/i
/** OpenMapTiles keeps suburbs and quarters in the same "Place labels" layer as towns, so a district is told by its filter. */
const DISTRICT_FILTER = /"(suburb|quarter|neighbou?rhood|hamlet)"/

export function isDistrictLayer(layer: StyleLayer): boolean {
  return NEIGHBOURHOOD_LAYER_ID.test(layer.id) || DISTRICT_FILTER.test(JSON.stringify(layer.filter ?? null))
}
const STYLE_MAX_ZOOM = 24
const OWN_LAYER_PREFIX = 'runomics-'

export const WATER_LABEL_LAYER = 'runomics-water-label'
/** Planet v4 schema, not OpenMapTiles: a river is named on `water_label`, kind in `class`; `waterway` carries no name. */
const WATER_LABEL_SOURCE_LAYER = 'water_label'
const WATER_LINE_CLASSES = ['river', 'canal'] as const
const ITALIC_FONT = ['Metropolis Semi Bold Italic', 'Noto Sans Italic']
const PLACE_FONT = ['Metropolis Semi Bold', 'Noto Sans Semi Bold']

function localName(lang: string | undefined): unknown {
  return lang && lang !== 'en' ? ['coalesce', ['get', `name:${lang}`], ['get', 'name']] : ['get', 'name']
}
/** Lower wins where two names want the same room. */
export const LABEL_SORT = { park: 1, landmark: 2, water: 3 } as const

function vectorSourceOf(map: MapLibreMap, sourceLayer: string): string | null {
  for (const raw of map.getStyle().layers) {
    const layer = raw as StyleLayer & { source?: string }
    if (layer['source-layer'] === sourceLayer && typeof layer.source === 'string') return layer.source
  }
  return null
}

export const PARK_LABEL_LAYER = 'runomics-park-label'
/**
 * A park's name is a POI point in the Planet v4 tiles (subclass `park`); the
 * polygon layers carry no name and no area, so zoom and label collision are
 * the only handles.
 */
const PARK_SOURCE_LAYER = 'poi_public'
const PARK_ICON = 'park'
const PARK_MIN_ZOOM = 12

export interface ParkLabelOptions {
  halo: string
  park: string
  size?: number
  lang?: string
}

/** The style fades hamlets in at zoom 14 and drops a city above 14 and a town above 16. */
export function showPlacesAtAnyZoom(map: MapLibreMap, options: { districtOpacity?: number } = {}): void {
  for (const raw of map.getStyle().layers) {
    const layer = raw as StyleLayer
    if (layer.id.startsWith(OWN_LAYER_PREFIX) || !isPlaceLabelLayer(layer)) continue
    map.setLayerZoomRange(layer.id, 0, STYLE_MAX_ZOOM)
    map.setPaintProperty(layer.id, 'text-opacity', isDistrictLayer(layer) ? (options.districtOpacity ?? 1) : 1)
  }
}

export const LANDMARK_LABEL_LAYER = 'runomics-landmark-label'
/** A short list, so a run through a city centre names a handful of landmarks rather than every shop. */
const LANDMARK_LAYERS = [
  { sourceLayer: 'poi_tourism', classes: ['attraction', 'castle', 'monument', 'artwork', 'viewpoint'] },
  { sourceLayer: 'poi_culture', classes: ['museum', 'theatre'] },
] as const
const LANDMARK_ICONS = ['attraction', 'castle', 'monument', 'artwork', 'viewpoint', 'museum', 'theatre'] as const
const LANDMARK_MIN_ZOOM = 13

export interface LandmarkLabelOptions {
  halo: string
  landmark: string
  size?: number
  lang?: string
}

export interface WaterLabelOptions {
  halo: string
  /** Never the water's own fill. */
  water: string
  size?: number
  lang?: string
}

export function addParkLabels(map: MapLibreMap, options: ParkLabelOptions): void {
  if (map.getLayer(PARK_LABEL_LAYER)) return
  const source = vectorSourceOf(map, PARK_SOURCE_LAYER)
  if (!source) return
  map.addLayer({
    id: PARK_LABEL_LAYER,
    type: 'symbol',
    source,
    'source-layer': PARK_SOURCE_LAYER,
    minzoom: PARK_MIN_ZOOM,
    filter: ['all', ['has', 'name'], ['==', ['get', 'subclass'], 'park']],
    layout: {
      'symbol-sort-key': LABEL_SORT.park,
      'icon-image': PARK_ICON,
      'icon-size': 0.6,
      'icon-optional': true,
      'text-field': localName(options.lang) as string,
      'text-font': PLACE_FONT,
      'text-size': options.size ?? 11,
      'text-anchor': 'top',
      'text-offset': [0, 0.7],
      'text-optional': true,
      'text-padding': 2,
      'text-max-width': 8,
    },
    paint: {
      'icon-color': options.park,
      'icon-halo-color': options.halo,
      'icon-halo-width': 1,
      'text-color': options.park,
      'text-halo-color': options.halo,
      'text-halo-width': 1.4,
      'text-halo-blur': 0.5,
    },
  } as Parameters<MapLibreMap['addLayer']>[0], firstSymbolLayerId(map))
}

export function addLandmarkLabels(map: MapLibreMap, options: LandmarkLabelOptions): void {
  for (const { sourceLayer, classes } of LANDMARK_LAYERS) {
    const id = `${LANDMARK_LABEL_LAYER}-${sourceLayer}`
    if (map.getLayer(id)) continue
    const source = vectorSourceOf(map, sourceLayer)
    if (!source) continue
    map.addLayer({
      id,
      type: 'symbol',
      source,
      'source-layer': sourceLayer,
      minzoom: LANDMARK_MIN_ZOOM,
      filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', [...classes]]]],
      layout: {
        'symbol-sort-key': LABEL_SORT.landmark,
        'icon-image': ['match', ['get', 'class'], [...LANDMARK_ICONS], ['get', 'class'], 'attraction'],
        'icon-size': 0.6,
        'icon-optional': true,
        'text-field': localName(options.lang) as string,
        'text-font': PLACE_FONT,
        'text-size': options.size ?? 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.7],
        'text-optional': true,
        'text-padding': 2,
        'text-max-width': 8,
      },
      paint: {
        'icon-color': options.landmark,
        'icon-halo-color': options.halo,
        'icon-halo-width': 1,
        'text-color': options.landmark,
        'text-halo-color': options.halo,
        'text-halo-width': 1.4,
        'text-halo-blur': 0.5,
      },
    } as Parameters<MapLibreMap['addLayer']>[0], firstSymbolLayerId(map))
  }
}

export function addWaterLabels(map: MapLibreMap, options: WaterLabelOptions): void {
  if (map.getLayer(WATER_LABEL_LAYER)) return
  const source = vectorSourceOf(map, WATER_LABEL_SOURCE_LAYER)
  if (!source) return
  const name = localName(options.lang)
  map.addLayer({
    id: WATER_LABEL_LAYER,
    type: 'symbol',
    source,
    'source-layer': WATER_LABEL_SOURCE_LAYER,
    filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', [...WATER_LINE_CLASSES]]]],
    layout: {
      'symbol-placement': 'line',
      'symbol-sort-key': LABEL_SORT.water,
      'symbol-spacing': 250,
      'text-field': name as string,
      'text-font': ITALIC_FONT,
      'text-size': options.size ?? 11,
      'text-letter-spacing': 0.1,
      'text-max-angle': 45,
      'text-allow-overlap': false,
      'text-padding': 2,
    },
    paint: {
      'text-color': options.water,
      'text-halo-color': options.halo,
      'text-halo-width': 1.4,
      'text-halo-blur': 0.5,
    },
  } as Parameters<MapLibreMap['addLayer']>[0], firstSymbolLayerId(map))
}
/** Beside its point too, so a name next to the route still finds room. */
const LABEL_ANCHORS: ('center' | 'top' | 'bottom' | 'left' | 'right')[] = ['center', 'top', 'bottom', 'left', 'right']
/** Ems: far enough to clear the route's fence, which runs right through the districts a run passes. */
const LABEL_RADIAL_OFFSET = 1.2

export function isPlaceLabelLayer(layer: StyleLayer): boolean {
  if (layer.type !== 'symbol') return false
  const source = layer['source-layer']
  return (source !== undefined && PLACE_SOURCE_LAYERS.includes(source)) || PLACE_LAYER_ID.test(layer.id)
}

export interface PlaceLabelColors {
  halo: string
  town: string
  neighbourhood: string
  districtOpacity?: number
}

/**
 * A name may sit on the route line, its halo keeps it readable, but the
 * markers and the edge fence sit above it and win. On the card's 300 px map a
 * name at 11-12 px found no room beside a loop, so names are a step smaller.
 */
export function styleRunMapLabels(map: MapLibreMap, colors: PlaceLabelColors): void {
  for (const raw of map.getStyle().layers) {
    const layer = raw as StyleLayer
    if (layer.id.startsWith(OWN_LAYER_PREFIX)) continue
    if (layer.type !== 'symbol') continue
    if (!isPlaceLabelLayer(layer)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
      continue
    }
    const small = isDistrictLayer(layer)
    map.setLayoutProperty(layer.id, 'visibility', 'visible')
    // Any zoom: the style's own ranges hid a town on a small map.
    map.setLayerZoomRange(layer.id, 0, STYLE_MAX_ZOOM)
    map.setLayoutProperty(layer.id, 'text-allow-overlap', false)
    map.setLayoutProperty(layer.id, 'text-padding', 2)
    map.setLayoutProperty(layer.id, 'text-variable-anchor', LABEL_ANCHORS)
    map.setLayoutProperty(layer.id, 'text-radial-offset', LABEL_RADIAL_OFFSET)
    map.setLayoutProperty(layer.id, 'text-size', small ? 9 : 10)
    map.setPaintProperty(layer.id, 'text-opacity', small ? (colors.districtOpacity ?? 1) : 1)
    map.setPaintProperty(layer.id, 'text-color', small ? colors.neighbourhood : colors.town)
    map.setPaintProperty(layer.id, 'text-halo-color', colors.halo)
    map.setPaintProperty(layer.id, 'text-halo-width', 1.5)
    map.setPaintProperty(layer.id, 'text-halo-blur', 0.5)
  }
}

/** The first label layer: the route goes under it, so names draw over the line. */
export function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((layer) => layer.type === 'symbol' && !layer.id.startsWith(OWN_LAYER_PREFIX))?.id
}

let workerConfigured = false

export async function loadMapLibre(): Promise<MapLibre> {
  const [mgl] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])

  if (!workerConfigured) {
    mgl.setWorkerUrl(workerUrl(mgl.getVersion()))
    // The pool outlives each map, so going back to the Map tab compiles no new workers.
    mgl.prewarm()
    workerConfigured = true
  }

  return mgl
}
