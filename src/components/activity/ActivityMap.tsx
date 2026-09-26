'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Maximize2, Minimize2 } from 'lucide-react'
import type { LngLatBounds, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { cn } from '@/lib/utils'
import { maptilerStyleUrl } from '@/lib/maptiler'
import { MAP_COLORS, PACE_ROUTE_COLORS, PACE_ROUTE_STOPS } from '@/lib/colors'
import { paceAtFraction } from '@/lib/paceRoute'
import { t } from '@/i18n'
import { loadMapLibre, showPlaceLabelsOnly } from '@/lib/maplibre'

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  className?: string
}

function buildSegmentFeatures(route: [number, number][], paceSamples: number[] | null | undefined) {
  return route.slice(0, -1).map((coord, i) => {
    const pace = paceAtFraction(paceSamples, i / Math.max(route.length - 2, 1))
    const next = route[i + 1]!
    return {
      type: 'Feature' as const,
      properties: { pace },
      geometry: { type: 'LineString' as const, coordinates: [coord, next] },
    }
  })
}

/**
 * The route's room inside the map. Nothing sits on the map but the expand
 * button and the attribution ⓘ in its corners (v4.8 2h), so the padding is
 * even.
 */
export const ROUTE_EDGE_PADDING = 24

function mkMarker(bg: string, border = 'white', size = 13) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    width: `${size}px`, height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: bg,
    border: `2px solid ${border}`,
    boxShadow: MAP_COLORS.chipShadow,
    pointerEvents: 'none',
  })
  return el
}

export default function ActivityMap({ route, paceSamples, hoverFraction, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // The element MapLibre draws into. Fullscreen portals the map to <body>,
  // which gives React a new host node; this one moves between hosts, so the
  // map is resized rather than rebuilt - style, tiles and the route animation
  // survive the toggle.
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const hasToken = !!process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  const mapRef = useRef<MapLibreMap | null>(null)
  const mglRef = useRef<typeof import('maplibre-gl') | null>(null)
  const hoverMarkerRef = useRef<Marker | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const boundsRef = useRef<LngLatBounds | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => setIsFullscreen(v => !v), [])

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
      map.fitBounds(boundsRef.current, { padding: ROUTE_EDGE_PADDING, maxZoom: 15, animate: false })
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

      const start = route[0]
      if (!start) return
      const [startLng, startLat] = start

      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
      hoverMarkerRef.current = null
      mglRef.current = mgl

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
        fitBoundsOptions: { padding: ROUTE_EDGE_PADDING, maxZoom: 15 },
        attributionControl: false,
      })
      map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-right')
      // MapLibre opens a compact attribution until the first drag, over the
      // route (H13). Start it as the ⓘ alone; a tap still expands it.
      map.once('idle', () => {
        mapEl.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      })

      const segments = buildSegmentFeatures(route, paceSamples)
      const hasPace = !!(paceSamples && paceSamples.length > 1)

      const lineColor: any = hasPace
        ? ['interpolate', ['linear'], ['get', 'pace'], ...PACE_ROUTE_STOPS.flat()]
        : PACE_ROUTE_COLORS.easy

      map.on('load', () => {
        if (cancelled) return

        showPlaceLabelsOnly(map)

        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'route-bg',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': isDark ? MAP_COLORS.routeCasingDark : MAP_COLORS.routeCasingLight, 'line-width': 7, 'line-opacity': 0.85 },
        })

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': lineColor, 'line-width': 4 },
        })

        new mgl.Marker({ element: mkMarker('var(--accent)') }).setLngLat(start).addTo(map)

        const total = segments.length
        const duration = 1800
        const startTime = performance.now()

        function animate() {
          if (cancelled) return
          const progress = Math.min((performance.now() - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const count = Math.floor(eased * total)

          ;(map.getSource('route') as any)?.setData({ type: 'FeatureCollection', features: segments.slice(0, count) })

          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(animate)
          } else {
            animFrameRef.current = null
            const last = route[route.length - 1]
            if (last && (Math.abs(last[0] - startLng) > 0.0005 || Math.abs(last[1] - startLat) > 0.0005)) {
              new mgl.Marker({ element: mkMarker(PACE_ROUTE_COLORS.fast) }).setLngLat(last).addTo(map)
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(animate)
      })

      mapRef.current = map
    }

    initMap(document.documentElement.classList.contains('dark'))

    const observer = new MutationObserver(() => {
      if (!cancelled) initMap(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelled = true
      observer.disconnect()
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
      hoverMarkerRef.current = null
    }
  }, [route, paceSamples])

  useEffect(() => {
    const map = mapRef.current
    const mgl = mglRef.current
    if (!map || !mgl) return

    if (hoverFraction == null) {
      hoverMarkerRef.current?.remove()
      hoverMarkerRef.current = null
      return
    }

    const coord = route[Math.round(hoverFraction * (route.length - 1))]
    if (!coord) return

    if (!hoverMarkerRef.current) {
      const el = mkMarker('white', 'var(--accent)', 14)
      el.style.border = '3px solid var(--accent)'
      hoverMarkerRef.current = new mgl.Marker({ element: el }).setLngLat(coord).addTo(map)
    } else {
      hoverMarkerRef.current.setLngLat(coord)
    }
  }, [hoverFraction, route])

  if (!hasToken) return <MapUnavailable className={className} />

  const tree = (
    <div
      className={cn(
        // The attribution ⓘ sits 12 px in from the right and bottom, as the
        // chips do (.activity-map in globals.css).
        'activity-map relative overflow-hidden rounded-xl',
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
