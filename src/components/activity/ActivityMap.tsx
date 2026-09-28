'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Maximize2, Minimize2 } from 'lucide-react'
import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl'
import { cn } from '@/lib/utils'
import { maptilerStyleUrl } from '@/lib/maptiler'
import { MAP_COLORS } from '@/lib/colors'
import { t } from '@/i18n'
import { loadMapLibre, styleRunMapLabels } from '@/lib/maplibre'
import { SURFACES } from '@/lib/themeTokens'
import {
  ROUTE_FIT_PADDING,
  addEdgeFence,
  addRunLayers,
  pointAlongRoute,
  setRunCursor,
  setRunRoute,
} from '@/lib/runMapLayers'

type LngLat = [number, number]

interface Props {
  route: LngLat[]
  /** The Charts scrub, as a share of the distance: the accent marker stands there. */
  hoverFraction?: number | null
  className?: string
}

export default function ActivityMap({ route, hoverFraction, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // The element MapLibre draws into. Fullscreen portals the map to <body>,
  // which gives React a new host node; this one moves between hosts, so the
  // map is resized rather than rebuilt - style, tiles and the route animation
  // survive the toggle.
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const hasToken = !!process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  const mapRef = useRef<MapLibreMap | null>(null)
  // What the run layers show, kept here so they can be drawn again as they
  // were: the route drawn so far and the scrub's point (v4.17).
  const drawnRef = useRef(0)
  const cursorRef = useRef<LngLat | null>(null)
  const layersReadyRef = useRef(false)
  const animFrameRef = useRef<number | null>(null)
  const boundsRef = useRef<LngLatBounds | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Fullscreen takes the map out of the page, which moves the scroll under
  // it; leaving puts the page back where it was, to the pixel (v5.5 #1): left
  // 1-2 pt down, iOS blurs the header under the status bar.
  const scrollBeforeFullscreen = useRef<number | null>(null)
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => {
      if (!v) scrollBeforeFullscreen.current = window.scrollY
      return !v
    })
  }, [])
  useLayoutEffect(() => {
    if (isFullscreen || scrollBeforeFullscreen.current === null) return
    window.scrollTo({ top: scrollBeforeFullscreen.current, behavior: 'instant' })
    scrollBeforeFullscreen.current = null
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen])

  useLayoutEffect(() => {
    const host = hostRef.current
    const el = mapElRef.current
    if (!host || !el) return
    if (el.parentElement !== host) host.appendChild(el)
    const map = mapRef.current
    if (!map) return
    map.resize()
    // Leaving fullscreen puts the route back as the card first showed it: a
    // pinch-zoom in fullscreen used to stay on the small map, with the route
    // cut off at the card's edges.
    if (!isFullscreen && boundsRef.current) {
      map.fitBounds(boundsRef.current, { padding: ROUTE_FIT_PADDING, maxZoom: 15, animate: false })
    }
  }, [isFullscreen])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    if (!mapElRef.current) {
      const el = document.createElement('div')
      el.style.width = '100%'
      el.style.height = '100%'
      mapElRef.current = el
    }
    const mapEl = mapElRef.current
    if (mapEl.parentElement !== host) host.appendChild(mapEl)

    async function initMap(isDark: boolean) {
      const mgl = await loadMapLibre()
      if (cancelled) return

      const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
      if (!token) { console.warn('NEXT_PUBLIC_MAPTILER_TOKEN not set'); return }

      const first = route[0]
      if (!first) return
      const start: LngLat = first

      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
      layersReadyRef.current = false

      const styleUrl = maptilerStyleUrl(isDark, token)
      const bounds = route.reduce(
        (b, c) => b.extend(c as [number, number]),
        new mgl.LngLatBounds(route[0], route[0])
      )
      boundsRef.current = bounds

      const map = new mgl.Map({
        container: mapEl,
        style: styleUrl,
        bounds,
        fitBoundsOptions: { padding: ROUTE_FIT_PADDING, maxZoom: 15 },
        attributionControl: false,
      })
      // The MapTiler and OpenStreetMap credit as a line of text in the
      // corner, always shown (v4.17): no longer folded behind an ⓘ.
      map.addControl(new mgl.AttributionControl({ compact: false }), 'bottom-right')

      map.on('load', () => {
        if (cancelled) return

        // Route and markers win; place names only fill the room left (v4.10).
        const mode = isDark ? 'dark' : 'light'
        styleRunMapLabels(map, { halo: SURFACES[mode].card, town: SURFACES[mode].text2, neighbourhood: SURFACES[mode].text3 })
        // The route is the athlete's own data, so it is the accent (v4.17);
        // it was coloured by pace.
        const accent = getComputedStyle(hostRef.current ?? document.documentElement).getPropertyValue('--accent').trim() || SURFACES[mode].text
        const replay = drawnRef.current >= route.length
        if (!replay) drawnRef.current = 0
        addRunLayers(map, {
          accent,
          ring: MAP_COLORS.markerRingLight,
          route: route.slice(0, drawnRef.current),
          start,
          cursor: cursorRef.current,
        })
        layersReadyRef.current = true
        const removeFence = addEdgeFence(map)
        map.once('remove', removeFence)
        // A theme or accent change rebuilds the map; the route is already
        // drawn by then and comes back whole.
        if (replay) return

        const total = route.length
        const duration = 1800
        const startTime = performance.now()

        function animate() {
          if (cancelled) return
          const progress = Math.min((performance.now() - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const count = Math.max(2, Math.floor(eased * total))
          if (count !== drawnRef.current) {
            drawnRef.current = count
            setRunRoute(map, route.slice(0, count))
          }
          animFrameRef.current = progress < 1 ? requestAnimationFrame(animate) : null
        }

        animFrameRef.current = requestAnimationFrame(animate)
      })

      mapRef.current = map
    }

    initMap(document.documentElement.classList.contains('dark'))

    const observer = new MutationObserver(() => {
      if (!cancelled) initMap(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent'] })

    return () => {
      cancelled = true
      observer.disconnect()
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
      layersReadyRef.current = false
      drawnRef.current = 0
    }
  }, [route])

  // The Charts scrub's point on the route, by distance - the charts' samples
  // are spread by distance, the GPS points by time.
  useEffect(() => {
    cursorRef.current = hoverFraction == null ? null : pointAlongRoute(route, hoverFraction)
    const map = mapRef.current
    if (map && layersReadyRef.current) setRunCursor(map, cursorRef.current)
  }, [hoverFraction, route])

  if (!hasToken) return <MapUnavailable className={className} />

  const tree = (
    <div
      className={cn(
        // The attribution sits 12 px in from the right and bottom, as the
        // chips do (.activity-map in globals.css), on the map's dark pill.
        'activity-map relative overflow-hidden rounded-xl',
        '[&_.maplibregl-ctrl-attrib]:rounded-md [&_.maplibregl-ctrl-attrib]:!bg-[var(--map-attrib-bg)] [&_.maplibregl-ctrl-attrib]:!px-1.5 [&_.maplibregl-ctrl-attrib]:!py-px',
        // Under the status strip, never touching the top edge (v4.8): iOS
        // kept the blur zone of a fullscreen map over the page's title.
        isFullscreen && 'activity-map-fullscreen fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[9999] rounded-none',
        className
      )}
    >
      <div ref={hostRef} role="img" aria-label={t.activity.map.routeMap} className="h-full w-full" />

      <button
        onClick={toggleFullscreen}
        className={cn(
          'glass-map-chip absolute right-3 z-20 flex h-11 w-11 items-center justify-center transition-opacity active:opacity-70',
          'top-3'
        )}
        aria-label={isFullscreen ? t.activity.map.exitFullscreen : t.activity.map.fullscreen}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

    </div>
  )

  return isFullscreen ? createPortal(tree, document.body) : tree
}

export function NoRouteMap({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted',
        className
      )}
    >
      <MapPin size={24} className="text-subtle" />
      <p className="text-sm text-subtle">{t.activity.map.noTrace}</p>
      <p className="text-xs text-subtle">{t.activity.map.noTraceHint}</p>
    </div>
  )
}

function MapUnavailable({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted',
        className
      )}
    >
      <MapPin size={24} className="text-subtle" />
      <p className="text-sm text-subtle">{t.activity.map.mapUnavailable}</p>
      <p className="text-xs text-subtle">{t.activity.map.mapUnavailableHint}</p>
    </div>
  )
}
