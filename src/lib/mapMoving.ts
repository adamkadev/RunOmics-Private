import type { Map as MapLibreMap } from 'maplibre-gl'

/** Read by globals.css. */
export const MAP_MOVING_ATTR = 'data-map-moving'

/** A blur over a WebGL canvas is redrawn on every frame of a pan or zoom, so the glass drops it while the map moves. */
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
