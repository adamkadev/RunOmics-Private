'use client'

import { useEffect, useState } from 'react'
import { loadImage } from '@/lib/shareCardDraw'
import { routeMapUrl, type LngLat } from '@/lib/shareCardMap'
import type { ThemeMode } from '@/lib/shareCardPalette'

export interface ShareCardMap {
  image: HTMLImageElement | null
  /** The basemap will not arrive - draw the stylized `map` design instead. */
  failed: boolean
}

// Keyed by URL, which already carries the route, the theme and the canvas size.
// The accent is deliberately absent: it only changes the trace we paint on top,
// so switching accents or toggling stats must never re-fetch the basemap.
const loaded = new Map<string, HTMLImageElement>()
const failed = new Set<string>()
const inFlight = new Map<string, Promise<HTMLImageElement>>()

function fetchMap(url: string): Promise<HTMLImageElement> {
  let pending = inFlight.get(url)
  if (!pending) {
    // Without crossOrigin the canvas is tainted and every export - share sheet,
    // PNG download, clipboard - throws on toBlob().
    pending = loadImage(url, 'anonymous')
    pending.catch(() => { /* surfaced through the hook's own catch */ })
    inFlight.set(url, pending)
  }
  return pending
}

/**
 * The MapTiler basemap behind the `route` design, memoized across renders and
 * across openings of the sheet.
 */
export function useShareCardMap(
  route: LngLat[] | null | undefined,
  theme: ThemeMode,
  width: number,
  height: number,
  enabled = true,
): ShareCardMap {
  const wanted = enabled && !!route && route.length > 1
  const url = wanted ? routeMapUrl(route!, theme, width, height) : null
  const [, bump] = useState(0)

  useEffect(() => {
    if (!url || loaded.has(url) || failed.has(url)) return
    let alive = true
    fetchMap(url)
      .then((img) => { loaded.set(url, img); if (alive) bump(n => n + 1) })
      .catch(() => { failed.add(url); if (alive) bump(n => n + 1) })
    return () => { alive = false }
  }, [url])

  return {
    image: url ? loaded.get(url) ?? null : null,
    // No URL while a route was asked for means no token: nothing to wait for.
    failed: wanted && (!url || failed.has(url)),
  }
}
