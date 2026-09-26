import type { Map as MapLibreMap } from 'maplibre-gl'

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

const PLACE_LABEL_SOURCE_LAYERS = ['city_label', 'town_label', 'place_label']

const STYLE_MAX_ZOOM = 24

export type MapLibre = typeof import('maplibre-gl')

export function showPlaceLabelsAtAnyZoom(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue

    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer']
    if (!sourceLayer || !PLACE_LABEL_SOURCE_LAYERS.includes(sourceLayer)) continue

    map.setLayerZoomRange(layer.id, 0, STYLE_MAX_ZOOM)
    map.setPaintProperty(layer.id, 'text-opacity', 1)
  }
}

/** Points of interest are the style's, not the run's: their labels clipped at
 *  the card's edge ("ts") and sat under the chips (v4.3.1). */
const POI_SOURCE_LAYERS = ['poi', 'poi_label', 'housenumber']

export function hidePoiLabels(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer']
    if (sourceLayer && POI_SOURCE_LAYERS.includes(sourceLayer)) map.setLayoutProperty(layer.id, 'visibility', 'none')
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
