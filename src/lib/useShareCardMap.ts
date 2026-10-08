'use client'

import { useEffect, useState } from 'react'
import { maptilerStyle } from '@/lib/maptiler'
import { ROUTE_INSET, simplifyRoute, type LngLat } from '@/lib/shareCardMap'
import type { ThemeMode } from '@/lib/shareCardPalette'
import { loadMapLibre, styleRunMapLabels } from '@/lib/maplibre'
import { SURFACES } from '@/lib/themeTokens'
import { addEdgeFence, addRunMarkers, clearMarkerImage, setRunFinish } from '@/lib/runMapLayers'

export interface ShareCardMap {
  image: HTMLCanvasElement | null
  points: [number, number][] | null
  failed: boolean
}

interface Render {
  image: HTMLCanvasElement
  points: [number, number][]
}

export interface ShareCardMapOptions {
  route: LngLat[] | null | undefined
  theme: ThemeMode
  width: number
  height: number
  enabled?: boolean
}

// The export is 1080 px wide, 3.6x the 300 px card. 3, a phone's own ratio,
// not 4: the basemap went missing from the card on the owner's phone when
// it went to 4 (Oct 2026), and grey streets lose nothing to the 1.2x the
// export scales them by.
const PIXEL_RATIO = 3

const RENDER_TIMEOUT_MS = 15_000

/**
 * Once the map has drawn all it will: 'idle'. A tile, glyph or sprite that
 * fails to load is not the map failing - MapLibre draws the rest and still
 * goes idle - so such an error is logged, where it used to cost the card its
 * whole basemap. Only a map that never settles fails, at the timeout.
 */
function settled(map: import('maplibre-gl').Map, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('basemap render timed out')), timeoutMs)
    map.on('error', (e) => console.warn('Share card basemap:', e.error?.message ?? e))
    map.once('idle', () => { clearTimeout(timer); resolve() })
  })
}

interface RenderOptions {
  route: LngLat[]
  theme: ThemeMode
  width: number
  height: number
}

async function renderRouteMap(opts: RenderOptions): Promise<Render> {
  const { route, theme, width, height } = opts
  const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!token) throw new Error('NEXT_PUBLIC_MAPTILER_TOKEN not set')

  const mgl = await loadMapLibre()
  const points = simplifyRoute(route)
  const first = points[0]
  if (!first) throw new Error('empty route')
  const isDark = theme === 'dark'

  const container = document.createElement('div')
  Object.assign(container.style, {
    // Off screen on both axes: nothing fixed sits at the top edge (v4.8).
    position: 'fixed', left: '-10000px', top: '-10000px',
    width: `${width}px`, height: `${height}px`, pointerEvents: 'none',
  })
  document.body.appendChild(container)

  const bounds = points.reduce((b, c) => b.extend(c), new mgl.LngLatBounds(first, first))
  const map = new mgl.Map({
    container,
    style: maptilerStyle(isDark, token),
    bounds,
    fitBoundsOptions: { padding: ROUTE_INSET, maxZoom: 15, duration: 0 },
    canvasContextAttributes: { preserveDrawingBuffer: true },
    pixelRatio: PIXEL_RATIO,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
  })

  // The Activity map's label rules (v4.10), with the halo in the card's own
  // background. The card paints the route and markers on top afterwards, so
  // clear icons stand in for the markers here: a name that would sit under
  // one is dropped, as on the Activity map, and so is one cut by the edge.
  const surface = SURFACES[isDark ? 'dark' : 'light']
  map.on('load', () => {
    styleRunMapLabels(map, { halo: surface.background, town: surface.text2, neighbourhood: surface.text3 })
    addRunMarkers(map, first, { start: clearMarkerImage(), finish: clearMarkerImage() })
    const last = points[points.length - 1]
    if (last && last !== first) setRunFinish(map, first, last)
    addEdgeFence(map)
  })

  try {
    await settled(map, RENDER_TIMEOUT_MS)

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const src = map.getCanvas()
    const image = document.createElement('canvas')
    image.width = src.width
    image.height = src.height
    image.getContext('2d')?.drawImage(src, 0, 0)

    return { image, points: points.map((c) => { const p = map.project(c); return [p.x, p.y] }) }
  } finally {
    map.remove()
    container.remove()
  }
}

const rendered = new Map<string, Render>()
const inFlight = new Map<string, Promise<Render>>()

function cacheKey(route: LngLat[], theme: ThemeMode, w: number, h: number): string {
  const pts = simplifyRoute(route)
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${pts.length}:${first}:${last}:${theme}:${w}x${h}`
}

export function useShareCardMap({
  route, theme, width, height, enabled = true,
}: ShareCardMapOptions): ShareCardMap {
  const wanted = enabled && !!route && route.length > 1
  const key = wanted ? cacheKey(route!, theme, width, height) : null
  const [, bump] = useState(0)
  // A failed map is this sheet's, not the session's: one that timed out once
  // - the phone busy, the network slow - left every later share without its
  // map until the app was closed. The next sheet tries again.
  const [failedKey, setFailedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!key || !route || rendered.has(key)) return
    let alive = true
    let pending = inFlight.get(key)
    if (!pending) {
      pending = renderRouteMap({ route, theme, width, height })
      pending.catch(() => {})
      inFlight.set(key, pending)
    }
    pending
      .then((r) => { rendered.set(key, r); if (alive) bump(n => n + 1) })
      .catch(() => { if (alive) setFailedKey(key) })
      .finally(() => inFlight.delete(key))
    return () => { alive = false }
    // key already encodes route, theme, width and height - listing them again
    // would re-render the map on every parent render that rebuilds the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const hit = key ? rendered.get(key) : undefined
  return {
    image: hit?.image ?? null,
    points: hit?.points ?? null,
    failed: !!key && failedKey === key,
  }
}
