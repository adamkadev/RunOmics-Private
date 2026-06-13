'use client'

import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { cn } from '@/lib/utils'

interface Props {
  route: [number, number][]
  hoverFraction?: number | null
  className?: string
}

const MAPTILER_STYLE_LIGHT = 'streets-v2'
const MAPTILER_STYLE_DARK  = 'backdrop-v4-dark'

export default function ActivityMap({ route, hoverFraction, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const mglRef = useRef<typeof import('maplibre-gl') | null>(null)
  const hoverMarkerRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function initMap(isDark: boolean) {
      const mgl = await import('maplibre-gl')
      await import('maplibre-gl/dist/maplibre-gl.css')
      if (cancelled) return

      const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
      if (!token) {
        console.warn('NEXT_PUBLIC_MAPTILER_TOKEN not set')
        return
      }

      mapRef.current?.remove()
      mapRef.current = null
      hoverMarkerRef.current = null
      mglRef.current = mgl

      const styleName = isDark ? MAPTILER_STYLE_DARK : MAPTILER_STYLE_LIGHT
      const styleUrl = `https://api.maptiler.com/maps/${styleName}/style.json?key=${token}`

      const bounds = route.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new mgl.LngLatBounds(route[0], route[0])
      )

      const map = new mgl.Map({
        container: containerRef.current!,
        style: styleUrl,
        bounds,
        fitBoundsOptions: { padding: 40, maxZoom: 15 },
        attributionControl: false,
      })

      map.addControl(new mgl.AttributionControl({ compact: true }))

      map.on('load', () => {
        if (cancelled) return

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route },
          },
        })

        map.addLayer({
          id: 'route-shadow',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#000000', 'line-width': 5, 'line-opacity': 0.15 },
        })

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#10b981', 'line-width': 3 },
        })

        const startEl = document.createElement('div')
        startEl.className = 'w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-md'
        new mgl.Marker({ element: startEl }).setLngLat(route[0]).addTo(map)

        const last = route[route.length - 1]
        if (Math.abs(last[0] - route[0][0]) > 0.0005 || Math.abs(last[1] - route[0][1]) > 0.0005) {
          const endEl = document.createElement('div')
          endEl.className = 'w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-md'
          new mgl.Marker({ element: endEl }).setLngLat(last).addTo(map)
        }
      })

      mapRef.current = map
    }

    initMap(document.documentElement.classList.contains('dark'))

    const observer = new MutationObserver(() => {
      if (!cancelled) {
        initMap(document.documentElement.classList.contains('dark'))
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelled = true
      observer.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      hoverMarkerRef.current = null
    }
  }, [route])

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
      const el = document.createElement('div')
      el.className = 'w-3.5 h-3.5 rounded-full bg-card border-[3px] border-emerald-600 shadow-md'
      hoverMarkerRef.current = new mgl.Marker({ element: el }).setLngLat(coord).addTo(map)
    } else {
      hoverMarkerRef.current.setLngLat(coord)
    }
  }, [hoverFraction, route])

  return (
    <div
      ref={containerRef}
      className={cn('h-full min-h-[280px] w-full overflow-hidden rounded-xl', className)}
    />
  )
}

export function NoRouteMap({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-gray-50 dark:bg-gray-900/50',
        className
      )}
    >
      <MapPin size={24} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-subtle">GPS trace unavailable</p>
      <p className="text-xs text-gray-300 dark:text-gray-600">Available after Garmin sync</p>
    </div>
  )
}
