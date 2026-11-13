export type MapLayer = 'heat' | 'districts'

export function parseMapLayer(value: string | null | undefined): MapLayer | null {
  return value === 'heat' || value === 'districts' ? value : null
}

/** Heat unless a link names the layer: Districts is never where the map opens by itself. */
export function initialMapLayer(urlParam: string | null): MapLayer {
  return parseMapLayer(urlParam) ?? 'heat'
}
