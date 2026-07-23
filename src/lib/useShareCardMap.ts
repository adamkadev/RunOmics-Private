'use client'

import { useEffect, useState } from 'react'
import { maptilerStyleUrl } from '@/lib/maptiler'
import { routePadding, simplifyRoute, type LngLat } from '@/lib/shareCardMap'
import type { ThemeMode } from '@/lib/shareCardPalette'

export interface ShareCardMap {
  /** The rendered basemap, ready to draw straight onto the card. */
  image: HTMLCanvasElement | null
  /** The route in card coordinates, as MapLibre itself projected it. */
  points: [number, number][] | null
  /** The basemap will not arrive - draw the stylized `map` design instead. */
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

// The basemap is rendered at 2x, the way the app's own maps are on a retina
// screen, then upscaled for the 3x export. Asking MapLibre for 3x would triple
// the tiles fetched for detail nobody sees at share-card size.
const PIXEL_RATIO = 2

// A cold render is style + tiles over the network. Anything slower than this is
// a stall, and the drawn `map` design is the better answer.
const RENDER_TIMEOUT_MS = 15_000

function once(map: import('maplibre-gl').Map, event: 'idle'): Promise<void> {
  return new Promise((resolve, reject) => {
    map.once(event, () => resolve())
    map.once('error', (e) => reject(e.error ?? new Error(`basemap ${event} failed`)))
  })
}

interface RenderOptions {
  route: LngLat[]
  theme: ThemeMode
  width: number
  height: number
}

/**
 * Renders the activity's basemap off-screen with MapLibre - the same renderer,
 * style and tiles as the map on the activity page - and hands back the pixels
 * plus the projected trace.
 *
 * Only the basemap is rendered here; the trace is painted onto the card
 * afterwards in the athlete's accent. That is what keeps changing accent free -
 * the cached render does not depend on it.
 */
async function renderRouteMap(opts: RenderOptions): Promise<Render> {
  const { route, theme, width, height } = opts
  const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!token) throw new Error('NEXT_PUBLIC_MAPTILER_TOKEN not set')

  const mgl = await import('maplibre-gl')
  const points = simplifyRoute(route)
  const first = points[0]
  if (!first) throw new Error('empty route')
  const isDark = theme === 'dark'

  // Off-screen but laid out: MapLibre sizes itself from the container, and a
  // `display:none` one would come back 0x0.
  const container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: `${width}px`, height: `${height}px`, pointerEvents: 'none',
  })
  document.body.appendChild(container)

  const bounds = points.reduce((b, c) => b.extend(c), new mgl.LngLatBounds(first, first))
  const map = new mgl.Map({
    container,
    style: maptilerStyleUrl(isDark, token),
    bounds,
    // maxZoom mirrors the activity map's fit: without it a short run zooms in
    // past the level the tiles are designed for. The per-side padding keeps the
    // trace framed between the card's title and stats on the tall frame.
    fitBoundsOptions: { padding: routePadding(width, height), maxZoom: 15, duration: 0 },
    // Reading pixels back out of a WebGL canvas needs the buffer kept around.
    canvasContextAttributes: { preserveDrawingBuffer: true },
    pixelRatio: PIXEL_RATIO,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
  })

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('basemap render timed out')), RENDER_TIMEOUT_MS))

  try {
    // `idle` means every tile for this viewport is loaded and painted.
    await Promise.race([once(map, 'idle'), timeout])

    // Two rAFs so the WebGL pipeline has fully flushed before the readback -
    // on some drivers `idle` fires before the last frame is presented, and
    // reading too early copies a blank buffer.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    // Copy the pixels out before the map is torn down: map.remove() disposes
    // its canvas, and the tiles are CORS-clean so nothing taints the copy.
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

// Keyed by route, theme and frame size. The accent is deliberately absent: it
// only tints the trace we paint on top, so switching accents or toggling stats
// must never re-render the basemap.
const rendered = new Map<string, Render>()
const failed = new Set<string>()
const inFlight = new Map<string, Promise<Render>>()

function cacheKey(route: LngLat[], theme: ThemeMode, w: number, h: number): string {
  const pts = simplifyRoute(route)
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${pts.length}:${first}:${last}:${theme}:${w}x${h}`
}

/**
 * The MapLibre render behind the `route` design, memoized across renders and
 * across openings of the sheet.
 */
export function useShareCardMap({
  route, theme, width, height, enabled = true,
}: ShareCardMapOptions): ShareCardMap {
  const wanted = enabled && !!route && route.length > 1
  const key = wanted ? cacheKey(route!, theme, width, height) : null
  const [, bump] = useState(0)

  useEffect(() => {
    if (!key || !route || rendered.has(key) || failed.has(key)) return
    let alive = true
    let pending = inFlight.get(key)
    if (!pending) {
      pending = renderRouteMap({ route, theme, width, height })
      pending.catch(() => { /* surfaced through the caller's own catch */ })
      inFlight.set(key, pending)
    }
    pending
      .then((r) => { rendered.set(key, r); if (alive) bump(n => n + 1) })
      .catch(() => { failed.add(key); if (alive) bump(n => n + 1) })
      .finally(() => inFlight.delete(key))
    return () => { alive = false }
    // The key already encodes route, theme and size; the rest would only
    // re-run the effect for renders that produce the same image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const hit = key ? rendered.get(key) : undefined
  return {
    image: hit?.image ?? null,
    points: hit?.points ?? null,
    failed: !!key && failed.has(key),
  }
}
