import type { Map as MapLibreMap } from 'maplibre-gl'

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

export type MapLibre = typeof import('maplibre-gl')

/** Where a style keeps its town and neighbourhood names (OpenMapTiles and the older v4 styles). */
const PLACE_SOURCE_LAYERS = ['place', 'city_label', 'town_label', 'place_label']
const PLACE_LAYER_ID = /\b(place|city|town|village|suburb|neighbou?rhood|hamlet|locality)\b/i
const STYLE_MAX_ZOOM = 24

export function isPlaceLabelLayer(layer: { id: string; type: string; 'source-layer'?: string }): boolean {
  if (layer.type !== 'symbol') return false
  const source = layer['source-layer']
  return (source !== undefined && PLACE_SOURCE_LAYERS.includes(source)) || PLACE_LAYER_ID.test(layer.id)
}

/**
 * Place names only on an activity's map and the share card (v4.8 2h): the
 * town and its neighbourhoods say where the run was. Streets, POIs and
 * house numbers stay off - they sat under the chips (v4.3.3), and the chips
 * have left the map since. Place labels show at any zoom, so a small map
 * still names its town.
 */
export function showPlaceLabelsOnly(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    if (isPlaceLabelLayer(layer as { id: string; type: string; 'source-layer'?: string })) {
      map.setLayoutProperty(layer.id, 'visibility', 'visible')
      map.setLayerZoomRange(layer.id, 0, STYLE_MAX_ZOOM)
    } else {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    }
  }
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
