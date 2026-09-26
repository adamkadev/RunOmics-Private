'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Maximize2, Minimize2 } from 'lucide-react'
import type { LngLatBounds, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { cn } from '@/lib/utils'
import { maptilerStyleUrl } from '@/lib/maptiler'
import { MAP_COLORS, PACE_ROUTE_COLORS } from '@/lib/colors'
import type { ActivityType, ActivityWeather } from '@/domain/activity/types'
import type { ShoeTag } from '@/domain/shoe/types'
import { ShoePairTag } from '@/components/activities/ShoePairTag'
import { sessionZone, zoneColor } from '@/lib/colors'
import { MAP_CHIP_CLASS, WeatherChips } from './WeatherChips'
import { t } from '@/i18n'
import { hideSymbolLabels, loadMapLibre } from '@/lib/maplibre'

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  weather?: ActivityWeather | null
  activityType?: ActivityType | null
  shoe?: ShoeTag | null
  className?: string
}

function buildSegmentFeatures(route: [number, number][], paceSamples: number[] | null | undefined) {
  return route.slice(0, -1).map((coord, i) => {
    let pace = 300
    if (paceSamples && paceSamples.length > 1) {
      const ratio = i / Math.max(route.length - 2, 1)
      const sampleIdx = ratio * (paceSamples.length - 1)
      const low = Math.floor(sampleIdx)
      const high = Math.min(Math.ceil(sampleIdx), paceSamples.length - 1)
      const t = sampleIdx - low
      pace = (paceSamples[low] ?? pace) * (1 - t) + (paceSamples[high] ?? pace) * t
    }
    const next = route[i + 1]!
    return {
      type: 'Feature' as const,
      properties: { pace },
      geometry: { type: 'LineString' as const, coordinates: [coord, next] },
    }
  })
}

/** The chips' inset from the map's edge, and the clear space kept between a
 *  chip and the route (v4.3.1). */
const CHIP_INSET = 12
const ROUTE_CLEARANCE = 8
const EDGE_PADDING = 24

/**
 * The route fitted inside what the chips leave free: the top chip rows and
 * the shoe chip each push that edge in by their height plus 8 px, so no chip
 * sits on the start or finish marker.
 */
export function routePadding(top: HTMLElement | null, bottom: HTMLElement | null) {
  const clear = (el: HTMLElement | null) =>
    el && el.offsetHeight > 0 ? Math.max(EDGE_PADDING, CHIP_INSET + el.offsetHeight + ROUTE_CLEARANCE) : EDGE_PADDING
  return { top: clear(top), bottom: clear(bottom), left: EDGE_PADDING, right: EDGE_PADDING }
}

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

export default function ActivityMap({ route, paceSamples, hoverFraction, weather, activityType, shoe, className }: Props) {
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
  const topChipsRef = useRef<HTMLDivElement>(null)
  const shoeChipRef = useRef<HTMLDivElement>(null)
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
      map.fitBounds(boundsRef.current, { padding: routePadding(topChipsRef.current, shoeChipRef.current), maxZoom: 15, animate: false })
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
        fitBoundsOptions: { padding: routePadding(topChipsRef.current, shoeChipRef.current), maxZoom: 15 },
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
        ? ['interpolate', ['linear'], ['get', 'pace'],
            255, PACE_ROUTE_COLORS.fast,
            300, PACE_ROUTE_COLORS.tempo,
            350, PACE_ROUTE_COLORS.steady,
            390, PACE_ROUTE_COLORS.easy,
            450, PACE_ROUTE_COLORS.recovery]
        : PACE_ROUTE_COLORS.easy

      map.on('load', () => {
        if (cancelled) return

        hideSymbolLabels(map)

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
        isFullscreen && 'activity-map-fullscreen fixed inset-0 z-[9999] rounded-none',
        className
      )}
    >
      <div ref={hostRef} role="img" aria-label={t.activity.map.routeMap} className="h-full w-full" />

      {/* The run's type and the weather on top, the shoe at the bottom:
          the map says what the run was (the owner's preference). The chips
          wrap to a second row rather than run under the expand button:
          12 px in, 8 px apart, clear of its 44 pt (v4.3.1). */}
      {(weather || activityType) && (
        <div
          ref={topChipsRef}
          data-testid="map-top-chips"
          className={cn(
            'pointer-events-none absolute left-3 right-16 z-10 flex flex-wrap items-center gap-2',
            isFullscreen ? 'top-[max(env(safe-area-inset-top),12px)]' : 'top-3'
          )}
        >
          {activityType && (
            <span className={MAP_CHIP_CLASS} data-testid="map-type-chip">
              <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: zoneColor(sessionZone({ type: activityType })) }} />
              {t.activityTypes[activityType]}
            </span>
          )}
          {weather && <WeatherChips weather={weather} />}
        </div>
      )}

      {shoe && (
        <div
          ref={shoeChipRef}
          className={cn(
            'pointer-events-none absolute left-3 right-12 z-10 flex',
            isFullscreen ? 'bottom-[max(env(safe-area-inset-bottom),12px)]' : 'bottom-3'
          )}
          data-testid="map-shoe-chip"
        >
          <ShoePairTag shoe={shoe} />
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className={cn(
          'glass-map-chip absolute right-3 z-20 flex h-11 w-11 items-center justify-center transition-opacity active:opacity-70',
          isFullscreen ? 'top-[max(env(safe-area-inset-top),12px)]' : 'top-3'
        )}
        aria-label={isFullscreen ? t.activity.map.exitFullscreen : t.activity.map.fullscreen}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      {isFullscreen && (
        <p className="pointer-events-none absolute bottom-8 left-3 z-10 text-caption text-white/60">
          {t.activity.map.escToExit}
        </p>
      )}
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
