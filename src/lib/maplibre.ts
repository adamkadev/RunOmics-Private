import type { Map as MapLibreMap } from 'maplibre-gl'

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

export type MapLibre = typeof import('maplibre-gl')

/**
 * No labels on an activity's map (v4.3.3): place names, POIs and street
 * names sat under the chips and the expand button ("Robertsau", "Bis…") and
 * clipped at the card's edge. The route, its markers and the chips say where
 * the run was. The share card's map follows it (v4.9); the heatmap keeps its labels.
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
