export type MapLayer = 'heat' | 'districts'

export const MAP_LAYER_KEY = 'runomics-map-layer'

export function parseMapLayer(value: string | null | undefined): MapLayer | null {
  return value === 'heat' || value === 'districts' ? value : null
}

export function readStoredMapLayer(): MapLayer {
  try {
    return parseMapLayer(localStorage.getItem(MAP_LAYER_KEY)) ?? 'heat'
  } catch {
    return 'heat'
  }
}

export function storeMapLayer(layer: MapLayer): void {
  try {
    localStorage.setItem(MAP_LAYER_KEY, layer)
  } catch {
    // Private mode or storage full: the layer still applies to this visit.
  }
}

export function initialMapLayer(urlParam: string | null, stored: MapLayer): MapLayer {
  return parseMapLayer(urlParam) ?? stored
}
