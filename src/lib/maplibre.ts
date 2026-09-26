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

/**
 * No labels on an activity's map (v4.3.3): place names, POIs and street
 * names sat under the chips and the expand button ("Robertsau", "Bis…") and
 * clipped at the card's edge. The route, its markers and the chips say where
 * the run was; the share card and the heatmap keep their labels.
 */
export function hideSymbolLabels(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none')
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
