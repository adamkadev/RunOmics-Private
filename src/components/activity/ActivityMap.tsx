'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Maximize2, Minimize2, Thermometer } from 'lucide-react'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { cn } from '@/lib/utils'
import { maptilerStyleUrl } from '@/lib/maptiler'
import { temperatureIconColor } from '@/lib/colors'
import { t } from '@/i18n'

interface Props {
  route: [number, number][]
  paceSamples?: number[] | null
  hoverFraction?: number | null
  avgTemperature?: number | null
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
      pace = paceSamples[low] * (1 - t) + paceSamples[high] * t
    }
    return {
      type: 'Feature' as const,
      properties: { pace },
      geometry: { type: 'LineString' as const, coordinates: [coord, route[i + 1]] },
    }
  })
}

function mkMarker(bg: string, border = 'white', size = 13) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    width: `${size}px`, height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: bg,
    border: `2px solid ${border}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  })
  return el
}

export default function ActivityMap({ route, paceSamples, hoverFraction, avgTemperature, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const mglRef = useRef<typeof import('maplibre-gl') | null>(null)
  const hoverMarkerRef = useRef<Marker | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => setIsFullscreen(v => !v), [])

  // Resize map after fullscreen DOM reflow
  useEffect(() => {
    const id = requestAnimationFrame(() => { mapRef.current?.resize() })
    return () => cancelAnimationFrame(id)
  }, [isFullscreen])

  // Escape to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen])

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function initMap(isDark: boolean) {
      const mgl = await import('maplibre-gl')
      await import('maplibre-gl/dist/maplibre-gl.css')
      if (cancelled) return

      const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
      if (!token) { console.warn('NEXT_PUBLIC_MAPTILER_TOKEN not set'); return }

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

      const map = new mgl.Map({
        container: containerRef.current!,
        style: styleUrl,
        bounds,
        fitBoundsOptions: { padding: 40, maxZoom: 15 },
        attributionControl: false,
      })
      map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-right')

      const segments = buildSegmentFeatures(route, paceSamples)
      const hasPace = !!(paceSamples && paceSamples.length > 1)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lineColor: any = hasPace
        ? ['interpolate', ['linear'], ['get', 'pace'],
            240, '#ef4444',  // ≤4:00/km → red
            300, '#f59e0b',  //  5:00/km → amber
            360, '#84cc16',  //  6:00/km → lime
            420, '#10b981']  // ≥7:00/km → green
        : '#10b981'

      map.on('load', () => {
        if (cancelled) return

        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'route-bg',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': isDark ? '#1f2937' : '#ffffff', 'line-width': 7, 'line-opacity': 0.85 },
        })

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': lineColor, 'line-width': 4 },
        })

        new mgl.Marker({ element: mkMarker('#10b981') }).setLngLat(route[0]).addTo(map)

        const total = segments.length
        const duration = 1800
        const startTime = performance.now()

        function animate() {
          if (cancelled) return
          const progress = Math.min((performance.now() - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const count = Math.floor(eased * total)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(map.getSource('route') as any)?.setData({ type: 'FeatureCollection', features: segments.slice(0, count) })

          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(animate)
          } else {
            animFrameRef.current = null
            const last = route[route.length - 1]
            if (Math.abs(last[0] - route[0][0]) > 0.0005 || Math.abs(last[1] - route[0][1]) > 0.0005) {
              new mgl.Marker({ element: mkMarker('#ef4444') }).setLngLat(last).addTo(map)
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

  // Sync hover marker with chart scrubbing
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
      const el = mkMarker('white', '#10b981', 14)
      el.style.border = '3px solid #10b981'
      hoverMarkerRef.current = new mgl.Marker({ element: el }).setLngLat(coord).addTo(map)
    } else {
      hoverMarkerRef.current.setLngLat(coord)
    }
  }, [hoverFraction, route])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        isFullscreen && 'fixed inset-0 z-[9999] rounded-none',
        className
      )}
    >
      <div ref={containerRef} className="h-full w-full" />

      {avgTemperature != null && (
        <div className="glass-map-chip absolute left-2 top-2 z-10 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold">
          <Thermometer size={12} className={temperatureIconColor(avgTemperature)} />
          {avgTemperature}{t.units.celsius}
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="glass-map-chip absolute right-2 top-2 z-10 flex h-[30px] w-[30px] items-center justify-center transition-opacity active:opacity-70"
        aria-label={isFullscreen ? t.activity.map.exitFullscreen : t.activity.map.fullscreen}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {isFullscreen && (
        <p className="pointer-events-none absolute bottom-8 left-3 z-10 text-[11px] text-white/60">
          {t.activity.map.escToExit}
        </p>
      )}
    </div>
  )
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
