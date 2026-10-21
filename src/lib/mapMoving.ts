import type { Map as MapLibreMap } from 'maplibre-gl'

/** Set on a map's root while its camera moves (globals.css). */
export const MAP_MOVING_ATTR = 'data-map-moving'

/**
 * Cheaper glass while a map moves (Liquid Glass v3, README §6.12.2): a blur
 * over a WebGL canvas is redrawn on every frame of a pan or a zoom, so while
 * the camera moves the glass over it drops its blur for a denser tint, and
 * fades back in 150 ms once it stops. The attribute goes on the closest
 * `[data-map-root]` - the element that holds both the canvas and its glass
 * controls - or the map's own container. Returns the cleanup.
 */
export function watchMapMoving(map: MapLibreMap): () => void {
  const root = () => map.getContainer().closest<HTMLElement>('[data-map-root]') ?? map.getContainer()
  const start = () => root().setAttribute(MAP_MOVING_ATTR, '')
  const end = () => root().removeAttribute(MAP_MOVING_ATTR)
  map.on('movestart', start)
  map.on('moveend', end)
  return () => {
    map.off('movestart', start)
    map.off('moveend', end)
    end()
  }
}
