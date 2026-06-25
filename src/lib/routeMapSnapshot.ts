import { maptilerStyleUrl } from '@/lib/maptiler'

interface SnapshotOptions {
  route: [number, number][]
  color: string
  isDark: boolean
  token: string
  width: number
  height: number
}

/**
 * Renders the route on an offscreen MapLibre map and captures it as a PNG data URL.
 * MapTiler's Static Maps API requires a paid plan, so this reuses the free vector
 * Maps API (same style/tiles as the interactive activity map) instead.
 */
export async function captureRouteMapSnapshot({ route, color, isDark, token, width, height }: SnapshotOptions): Promise<string> {
  const mgl = await import('maplibre-gl')

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  document.body.appendChild(container)

  const bounds = route.reduce(
    (b, c) => b.extend(c as [number, number]),
    new mgl.LngLatBounds(route[0], route[0])
  )

  const map = new mgl.Map({
    container,
    style: maptilerStyleUrl(isDark, token),
    bounds,
    fitBoundsOptions: { padding: 40, maxZoom: 15 },
    attributionControl: false,
    interactive: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  })

  try {
    await new Promise<void>((resolve, reject) => {
      map.once('load', () => resolve())
      map.once('error', (e) => reject(e.error ?? new Error('MapLibre load failed')))
    })

    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } },
    })
    map.addLayer({
      id: 'route-bg',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': isDark ? '#1f2937' : '#ffffff', 'line-width': 9, 'line-opacity': 0.85 },
    })
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 6 },
    })

    await new Promise<void>((resolve) => map.once('idle', () => resolve()))

    // Two rAFs to ensure the WebGL pipeline has fully flushed before toDataURL.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const canvas = map.getCanvas()
    try {
      return canvas.toDataURL('image/png')
    } catch (err) {
      throw new Error(`Map canvas export failed (CORS or WebGL issue): ${(err as Error).message}`)
    }
  } finally {
    map.remove()
    container.remove()
  }
}
