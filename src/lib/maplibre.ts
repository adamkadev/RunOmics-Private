import type { Map as MapLibreMap } from 'maplibre-gl'

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

export type MapLibre = typeof import('maplibre-gl')

type StyleLayer = { id: string; type: string; 'source-layer'?: string }
type Filter = unknown[]

/** Where a style keeps its town and neighbourhood names (OpenMapTiles and the older v4 styles). */
const PLACE_SOURCE_LAYERS = ['place', 'city_label', 'town_label', 'place_label']
const PLACE_LAYER_ID = /\b(place|city|town|village|suburb|neighbou?rhood|hamlet|quarter|locality)\b/i
/** The small places: shown only from zoom 14, which in practice is fullscreen (v4.10). */
const NEIGHBOURHOOD_LAYER_ID = /\b(suburb|neighbou?rhood|hamlet|quarter|isolated)\b/i
const TOWN_LAYER_ID = /\b(city|cities|town|village)\b/i
export const NEIGHBOURHOOD_MIN_ZOOM = 14
const STYLE_MAX_ZOOM = 24
const TOWN_CLASSES = ['city', 'town', 'village']

export function isPlaceLabelLayer(layer: StyleLayer): boolean {
  if (layer.type !== 'symbol') return false
  const source = layer['source-layer']
  return (source !== undefined && PLACE_SOURCE_LAYERS.includes(source)) || PLACE_LAYER_ID.test(layer.id)
}

const LEGACY_OPS = ['==', '!=', 'in', '!in', 'has', '!has', '<', '>', '<=', '>=']

/** A filter in the old ["==", "class", "town"] form, which an expression can't be combined with. */
export function isLegacyFilter(filter: unknown): boolean {
  if (!Array.isArray(filter)) return false
  const [op, ...args] = filter
  if (['all', 'any', 'none'].includes(op as string)) return args.some(isLegacyFilter)
  return LEGACY_OPS.includes(op as string) && typeof args[0] === 'string'
}

/** The layer's filter narrowed to towns and villages, in whichever syntax it already uses. */
export function townsOnly(existing: unknown): Filter {
  if (!existing) return ['match', ['get', 'class'], TOWN_CLASSES, true, false]
  if (isLegacyFilter(existing)) return ['all', existing, ['in', 'class', ...TOWN_CLASSES]]
  return ['all', existing, ['match', ['get', 'class'], TOWN_CLASSES, true, false]]
}

export interface PlaceLabelColors {
  /** The surface under the map: the halo that keeps a name readable over the route. */
  halo: string
  /** Towns and villages, --muted-foreground. */
  town: string
  /** Neighbourhoods, a step quieter. */
  neighbourhood: string
}

/**
 * Place names only, and only where the run leaves room (v4.10). Streets,
 * POIs and house numbers are off. Towns and villages show at any zoom;
 * suburbs, neighbourhoods and hamlets from zoom 14. Every name is muted with
 * a halo in the map's own surface colour, never bold white, and collides:
 * the route markers and the edge fence sit above it and win, so a name
 * that would touch a marker or the edge is dropped rather than drawn.
 */
export function styleRunMapLabels(map: MapLibreMap, colors: PlaceLabelColors): void {
  for (const raw of map.getStyle().layers) {
    const layer = raw as StyleLayer
    if (layer.type !== 'symbol') continue
    if (!isPlaceLabelLayer(layer)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
      continue
    }
    const small = NEIGHBOURHOOD_LAYER_ID.test(layer.id)
    map.setLayoutProperty(layer.id, 'visibility', 'visible')
    map.setLayerZoomRange(layer.id, small ? NEIGHBOURHOOD_MIN_ZOOM : 0, STYLE_MAX_ZOOM)
    // One layer for every kind of place: keep its towns only.
    if (!small && !TOWN_LAYER_ID.test(layer.id)) map.setFilter(layer.id, townsOnly(map.getFilter(layer.id)) as never)
    map.setLayoutProperty(layer.id, 'text-allow-overlap', false)
    map.setLayoutProperty(layer.id, 'text-padding', 4)
    map.setLayoutProperty(layer.id, 'text-variable-anchor', ['center'])
    map.setLayoutProperty(layer.id, 'text-size', small ? 11 : 12)
    map.setPaintProperty(layer.id, 'text-color', small ? colors.neighbourhood : colors.town)
    map.setPaintProperty(layer.id, 'text-halo-color', colors.halo)
    map.setPaintProperty(layer.id, 'text-halo-width', 1.5)
    map.setPaintProperty(layer.id, 'text-halo-blur', 0.5)
  }
}

/** The first label layer: the route goes under it, so names draw over the line. */
export function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
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
