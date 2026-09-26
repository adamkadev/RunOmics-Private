'use client'

import { useEffect, useState } from 'react'
import { maptilerStyleUrl } from '@/lib/maptiler'
import { routePadding, simplifyRoute, type LngLat } from '@/lib/shareCardMap'
import type { ThemeMode } from '@/lib/shareCardPalette'
import { hideSymbolLabels, loadMapLibre } from '@/lib/maplibre'

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

// The export is 1080 px wide, about 2.8x the card: 3 keeps the map sharp in it.
const PIXEL_RATIO = 3

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
    style: maptilerStyleUrl(isDark, token),
    bounds,
    fitBoundsOptions: { padding: routePadding(width, height), maxZoom: 15, duration: 0 },
    canvasContextAttributes: { preserveDrawingBuffer: true },
    pixelRatio: PIXEL_RATIO,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
  })

  // No place or street names under the route, as on the Activity map (v4.9).
  map.on('load', () => hideSymbolLabels(map))

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('basemap render timed out')), RENDER_TIMEOUT_MS))

  try {
    await Promise.race([once(map, 'idle'), timeout])

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
const failed = new Set<string>()
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

  useEffect(() => {
    if (!key || !route || rendered.has(key) || failed.has(key)) return
    let alive = true
    let pending = inFlight.get(key)
    if (!pending) {
      pending = renderRouteMap({ route, theme, width, height })
      pending.catch(() => {})
      inFlight.set(key, pending)
    }
    pending
      .then((r) => { rendered.set(key, r); if (alive) bump(n => n + 1) })
      .catch(() => { failed.add(key); if (alive) bump(n => n + 1) })
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
    failed: !!key && failed.has(key),
  }
}
