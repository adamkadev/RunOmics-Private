import type { Map as MapLibreMap } from 'maplibre-gl'

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

export type MapLibre = typeof import('maplibre-gl')

type StyleLayer = { id: string; type: string; 'source-layer'?: string }

/** Where a style keeps its town and neighbourhood names (OpenMapTiles and the older v4 styles). */
const PLACE_SOURCE_LAYERS = ['place', 'city_label', 'town_label', 'place_label']
const PLACE_LAYER_ID = /\b(place|city|town|village|suburb|neighbou?rhood|hamlet|quarter|locality)\b/i
/** Neighbourhoods and quartiers: drawn a step smaller and quieter than towns. */
const NEIGHBOURHOOD_LAYER_ID = /\b(suburb|neighbou?rhood|hamlet|quarter|isolated)\b/i
const STYLE_MAX_ZOOM = 24
/** On its point first, then beside it, so a name next to the route still finds room. */
const LABEL_ANCHORS: ('center' | 'top' | 'bottom' | 'left' | 'right')[] = ['center', 'top', 'bottom', 'left', 'right']

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
    if (layer.type !== 'symbol') continue
    if (!isPlaceLabelLayer(layer)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
      continue
    }
    const small = NEIGHBOURHOOD_LAYER_ID.test(layer.id)
    map.setLayoutProperty(layer.id, 'visibility', 'visible')
    // Any zoom: the style's own ranges hid a town on a small map.
    map.setLayerZoomRange(layer.id, 0, STYLE_MAX_ZOOM)
    map.setLayoutProperty(layer.id, 'text-allow-overlap', false)
    map.setLayoutProperty(layer.id, 'text-padding', 2)
    map.setLayoutProperty(layer.id, 'text-variable-anchor', LABEL_ANCHORS)
    map.setLayoutProperty(layer.id, 'text-radial-offset', 0.4)
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
