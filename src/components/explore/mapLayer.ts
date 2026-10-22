/**
 * Which layer the Activities map draws: the heat (default) or the Districts.
 * Kept in localStorage so the map reopens on the layer last chosen; a link
 * may ask for Districts with `?layer=districts`, read when the map mounts
 * and stored. The address is never written on load; a change of layer by
 * hand takes the link's `layer` out of it, so the link applies once.
 */

export type MapLayer = 'heat' | 'districts'

export const MAP_LAYER_KEY = 'runomics-map-layer'

/** A stored or linked value as a layer; anything else is null. */
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

/** The link's layer when it names one, else the one last chosen. */
export function initialMapLayer(urlParam: string | null, stored: MapLayer): MapLayer {
  return parseMapLayer(urlParam) ?? stored
}
