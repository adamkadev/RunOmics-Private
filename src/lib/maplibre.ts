import type { Map as MapLibreMap } from 'maplibre-gl'

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

export type MapLibre = typeof import('maplibre-gl')

type StyleLayer = { id: string; type: string; 'source-layer'?: string; filter?: unknown }

/** Where a style keeps its town and neighbourhood names (OpenMapTiles and the older v4 styles). */
const PLACE_SOURCE_LAYERS = ['place', 'city_label', 'town_label', 'place_label']
const PLACE_LAYER_ID = /\b(place|city|town|village|suburb|neighbou?rhood|hamlet|quarter|locality)\b/i
/** Neighbourhoods and quartiers: drawn a step smaller and quieter than towns. */
const NEIGHBOURHOOD_LAYER_ID = /\b(suburb|neighbou?rhood|hamlet|quarter|isolated)\b/i
/**
 * A district layer the style names by its filter, not its id: OpenMapTiles
 * keeps suburbs and quarters in the same "Place labels" layer as towns, so
 * matching on the id alone left every district at the town's size and ink.
 */
const DISTRICT_FILTER = /"(suburb|quarter|neighbou?rhood|hamlet)"/

function isDistrictLayer(layer: StyleLayer): boolean {
  return NEIGHBOURHOOD_LAYER_ID.test(layer.id) || DISTRICT_FILTER.test(JSON.stringify(layer.filter ?? null))
}
const STYLE_MAX_ZOOM = 24
/** The layers this app adds to a MapTiler style; styleRunMapLabels leaves them be. */
const OWN_LAYER_PREFIX = 'runomics-'

export const WATER_LABEL_LAYER = 'runomics-water-label'
/**
 * The tiles name a river on `water_label`, as a line, with its kind in
 * `class`: the Planet v4 schema, not OpenMapTiles - `waterway` carries the
 * geometry and no name at all, and there is no `water_name` layer.
 */
const WATER_LABEL_SOURCE_LAYER = 'water_label'
const WATER_LINE_CLASSES = ['river', 'canal'] as const
const ITALIC_FONT = ['Metropolis Semi Bold Italic', 'Noto Sans Italic']
const PLACE_FONT = ['Metropolis Semi Bold', 'Noto Sans Semi Bold']

/** The name in the reader's language where the tiles carry one. */
function localName(lang: string | undefined): unknown {
  return lang && lang !== 'en' ? ['coalesce', ['get', `name:${lang}`], ['get', 'name']] : ['get', 'name']
}
/** Park over water over district, where two names want the same room. */
export const LABEL_SORT = { park: 1, landmark: 2, water: 3 } as const

/** The vector source a style keeps a given source-layer on. */
function vectorSourceOf(map: MapLibreMap, sourceLayer: string): string | null {
  for (const raw of map.getStyle().layers) {
    const layer = raw as StyleLayer & { source?: string }
    if (layer['source-layer'] === sourceLayer && typeof layer.source === 'string') return layer.source
  }
  return null
}

export const PARK_LABEL_LAYER = 'runomics-park-label'
/**
 * A park's name is a POI point in the Planet v4 tiles - `poi_public`, class
 * `public`, subclass `park` - not a `park` source-layer and not OpenMapTiles'
 * `poi` class. The polygon layers (`leisure`, `forest`, `wood`) carry no name
 * and no area, so a park cannot be skipped by how big it is: zoom and the
 * collision between labels are the only handles.
 */
const PARK_SOURCE_LAYER = 'poi_public'
const PARK_ICON = 'park'
const PARK_MIN_ZOOM = 12

export interface ParkLabelOptions {
  halo: string
  /** The name's ink, and the tree's: a muted green-grey. */
  park: string
  size?: number
  lang?: string
}

/**
 * Every place name the style keeps, at any zoom, big or small. The tiles hold
 * hamlets and isolated dwellings, but the style fades them in at zoom 14; a
 * city label is dropped above 14 and a town above 16. So a run through a
 * hamlet passed through nothing named, and zooming into a city lost its name.
 * The route's own fence still decides which of them find room.
 */
export function showPlacesAtAnyZoom(map: MapLibreMap, options: { districtOpacity?: number } = {}): void {
  for (const raw of map.getStyle().layers) {
    const layer = raw as StyleLayer
    if (layer.id.startsWith(OWN_LAYER_PREFIX) || !isPlaceLabelLayer(layer)) continue
    map.setLayerZoomRange(layer.id, 0, STYLE_MAX_ZOOM)
    map.setPaintProperty(layer.id, 'text-opacity', isDistrictLayer(layer) ? (options.districtOpacity ?? 1) : 1)
  }
}

export const LANDMARK_LABEL_LAYER = 'runomics-landmark-label'
/**
 * The places a city is known for. The tiles split POIs by category, so a
 * landmark is a castle or an attraction on `poi_tourism` and a museum or a
 * theatre on `poi_culture`; each class has its own icon in the sprite. Kept
 * to a short list, so a run through a city centre names a handful of
 * landmarks rather than every shop on the way.
 */
const LANDMARK_LAYERS = [
  { sourceLayer: 'poi_tourism', classes: ['attraction', 'castle', 'monument', 'artwork', 'viewpoint'] },
  { sourceLayer: 'poi_culture', classes: ['museum', 'theatre'] },
] as const
const LANDMARK_ICONS = ['attraction', 'castle', 'monument', 'artwork', 'viewpoint', 'museum', 'theatre'] as const
const LANDMARK_MIN_ZOOM = 13

export interface LandmarkLabelOptions {
  halo: string
  /** The name's ink and its icon's. */
  landmark: string
  size?: number
  lang?: string
}

export interface WaterLabelOptions {
  /** The surface under the map, for the halo. */
  halo: string
  /** The name's ink: a pale blue-grey, never the water's own fill. */
  water: string
  /** 11 px in the app; the card draws a step smaller. */
  size?: number
  /** The locale's name field, e.g. `name:fr`; the plain name is the fallback. */
  lang?: string
}

/**
 * Rivers and canals named along their line (Bevel's reading of a city map):
 * italic, pale, and optional - a name that finds no room is dropped rather
 * than pushed over the route. Placed under the place names, which win.
 */
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
/** On its point first, then beside it, so a name next to the route still finds room. */
const LABEL_ANCHORS: ('center' | 'top' | 'bottom' | 'left' | 'right')[] = ['center', 'top', 'bottom', 'left', 'right']
/**
 * How far a name may step off its own point, in ems: far enough to clear the
 * route's fence, which runs right through the districts a run passes.
 */
const LABEL_RADIAL_OFFSET = 1.2

export function isPlaceLabelLayer(layer: StyleLayer): boolean {
  if (layer.type !== 'symbol') return false
  const source = layer['source-layer']
  return (source !== undefined && PLACE_SOURCE_LAYERS.includes(source)) || PLACE_LAYER_ID.test(layer.id)
}

export interface PlaceLabelColors {
  /** The surface under the map: the halo that keeps a name readable over the route. */
  halo: string
  /** Towns and villages, --muted-foreground. */
  town: string
  /** Neighbourhoods, a step quieter. */
  neighbourhood: string
  /** How opaque a district's name is; 1 unless the caller wants them fainter. */
  districtOpacity?: number
}

/**
 * Place names only (v4.10, v4.13.1): towns, villages and quartiers at any
 * zoom, so even a short loop inside one town names where it was. A name
 * may sit on the route line - its halo keeps it readable there - but the
 * start and finish markers and the edge fence sit above it and win, so a
 * name under a marker or cut by the edge is dropped rather than drawn.
 * Streets, POIs and house numbers stay off. Every name is muted, never
 * bold white. Every name kept is fully opaque (3.0.1): the style's zoom
 * steps faded districts out below 13, which left the share card with none.
 * On the card's 300 px map a name at the app's 11-12 px took a third of the
 * width and found no room beside a loop, so names are a step smaller and
 * may sit beside their point, not only on it.
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
  const mgl = await import('maplibre-gl')
  await import('maplibre-gl/dist/maplibre-gl.css')

  if (!workerConfigured) {
    mgl.setWorkerUrl(WORKER_URL)
    workerConfigured = true
  }

  return mgl
}
