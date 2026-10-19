'use client'

import { useEffect, useLayoutEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Layers, LocateFixed, MapPin, X } from 'lucide-react'
import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl'
import { cn } from '@/lib/utils'
import { maptilerStyle } from '@/lib/maptiler'
import { MapAttribution } from '@/components/ui/MapAttribution'
import { t } from '@/i18n'
import { addParkLabels, addWaterLabels, loadMapLibre } from '@/lib/maplibre'
import { SURFACES } from '@/lib/themeTokens'
import {
  ROUTE_FIT_PADDING,
  addEdgeFence,
  addRunLayers,
  setRunAccent,
  pointAlongRoute,
  runEndsJoined,
  setRunCursor,
  setRunEnds,
  setRunRoute,
} from '@/lib/runMapLayers'

type LngLat = [number, number]

interface Props {
  route: LngLat[]
  /** The Charts scrub, as a share of the distance: the accent marker stands there. */
  hoverFraction?: number | null
  className?: string
  /** Whether the map fills the screen. The page's own expand button opens it. */
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  /** Drawn over the tiles and under the map's own controls while in the page. */
  overlay?: ReactNode
  /** The run's name, date and numbers, floating at the foot of the fullscreen map. */
  card?: ReactNode
}

const noop = () => {}

/**
 * The basemaps the fullscreen style button cycles through (3.0). The design
 * asks for dark, light and satellite; the app's MapTiler styles are the dark
 * and light RunOmics greys, with no satellite one built yet, so the button
 * cycles the two that exist.
 */
const WATER_INK = { light: '#5f7f9a', dark: '#5b7d99' } as const
const PARK_INK = { light: '#5e7f65', dark: '#5f8a6d' } as const
const MAP_LANG = t.locale.split('-')[0] ?? 'en'

const MAP_STYLES = ['dark', 'light'] as const
type MapStyle = (typeof MAP_STYLES)[number]

const themeStyle = (): MapStyle => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

/** Clear of the top buttons, the sides and the floating card, so the route sits in what is left. */
function fullscreenPadding(cardHeight: number) {
  return { top: 76, right: 32, bottom: cardHeight + 56, left: 32 }
}

export default function ActivityMap({ route, hoverFraction, className, fullscreen = false, onFullscreenChange = noop, overlay, card }: Props) {
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
  const isFullscreen = fullscreen
  const cardRef = useRef<HTMLDivElement>(null)
  // The basemap picked in fullscreen; null follows the theme. Read by the
  // theme observer inside the map's effect, so kept in a ref as well.
  const [styleChoice, setStyleChoice] = useState<MapStyle | null>(null)
  const styleChoiceRef = useRef<MapStyle | null>(null)
  const applyStyleRef = useRef<((style: MapStyle) => void) | null>(null)
  // Leaving fullscreen gives the page's map back its theme's style.
  const close = useCallback(() => {
    setStyleChoice(null)
    onFullscreenChange(false)
  }, [onFullscreenChange])

  useEffect(() => {
    styleChoiceRef.current = styleChoice
    applyStyleRef.current?.(styleChoice ?? themeStyle())
  }, [styleChoice])

  const recenter = useCallback(() => {
    const map = mapRef.current
    if (!map || !boundsRef.current) return
    map.fitBounds(boundsRef.current, { padding: fullscreenPadding(cardRef.current?.offsetHeight ?? 0), maxZoom: 15 })
  }, [])

  // Fullscreen takes the map out of the page, which moves the scroll under
  // it; leaving puts the page back where it was, to the pixel (v5.5 #1): left
  // 1-2 pt down, iOS blurs the header under the status bar. The hero keeps
  // its height while the map is away, so the offset read on the way in is
  // still the page's own.
  const scrollBeforeFullscreen = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (isFullscreen) {
      scrollBeforeFullscreen.current = window.scrollY
      return
    }
    if (scrollBeforeFullscreen.current === null) return
    window.scrollTo({ top: scrollBeforeFullscreen.current, behavior: 'instant' })
    scrollBeforeFullscreen.current = null
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen, close])

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
    // cut off at the card's edges. Entering centres it between the buttons
    // and the floating card.
    if (!boundsRef.current) return
    const padding = isFullscreen ? fullscreenPadding(cardRef.current?.offsetHeight ?? 0) : ROUTE_FIT_PADDING
    map.fitBounds(boundsRef.current, { padding, maxZoom: 15, animate: false })
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

    const isDark = () => document.documentElement.classList.contains('dark')
    const readAccent = () =>
      getComputedStyle(hostRef.current ?? document.documentElement).getPropertyValue('--accent').trim() ||
      SURFACES[isDark() ? 'dark' : 'light'].text
    // The route's halo and the start's ring are the page behind the map
    // (3.0): the theme's --background, or the picked basemap's own page
    // colour while fullscreen shows the other one.
    const readRing = (darkMap: boolean) =>
      (styleChoiceRef.current === null &&
        getComputedStyle(hostRef.current ?? document.documentElement).getPropertyValue('--background').trim()) ||
      SURFACES[darkMap ? 'dark' : 'light'].background
    let removeFence: (() => void) | null = null
    let stopObserving: (() => void) | null = null

    async function initMap() {
      const mgl = await loadMapLibre()
      if (cancelled) return

      const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
      if (!token) { console.warn('NEXT_PUBLIC_MAPTILER_TOKEN not set'); return }

      const first = route[0]
      if (!first) return
      const start: LngLat = first
      // The finish is the drawn line's own last point (design review, Oct 2026),
      // shown once the draw-in reaches it.
      const finish: LngLat | null = route.length > 1 ? route[route.length - 1]! : null

      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
      mapRef.current?.remove()
      mapRef.current = null
      layersReadyRef.current = false

      let dark = (styleChoiceRef.current ?? themeStyle()) === 'dark'
      let accent = readAccent()
      const bounds = route.reduce(
        (b, c) => b.extend(c as [number, number]),
        new mgl.LngLatBounds(route[0], route[0])
      )
      boundsRef.current = bounds

      const map = new mgl.Map({
        container: mapEl,
        style: maptilerStyle(dark, token),
        bounds,
        fitBoundsOptions: { padding: ROUTE_FIT_PADDING, maxZoom: 15 },
        attributionControl: false,
      })
      mapRef.current = map

      // A loop's start and finish are one marker while they would touch: asked
      // again at every zoom, so zooming in parts them.
      let joined = false
      const finishShown = () => finish !== null && drawnRef.current >= route.length
      function updateEnds(force = false) {
        if (!finishShown() || !finish) return
        const next = runEndsJoined(map, start, finish)
        if (!force && next === joined) return
        joined = next
        setRunEnds(map, start, finish, joined)
      }
      map.on('zoom', () => { if (layersReadyRef.current) updateEnds() })

      function animateRoute() {
        const total = route.length
        const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1800
        const startTime = performance.now()
        function animate() {
          if (cancelled) return
          const progress = duration === 0 ? 1 : Math.min((performance.now() - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const count = Math.max(2, Math.floor(eased * total))
          if (count !== drawnRef.current) {
            drawnRef.current = count
            setRunRoute(map, route.slice(0, count))
            if (count >= total) updateEnds(true)
          }
          // Screenshots wait for this mark.
          if (progress >= 1 && hostRef.current) hostRef.current.dataset.routeDrawn = ''
          animFrameRef.current = progress < 1 ? requestAnimationFrame(animate) : null
        }
        animFrameRef.current = requestAnimationFrame(animate)
      }

      // The first style and every one after it (v4.17): the camera stays and
      // the run comes back as far as it was drawn. Place names are the
      // style's own - quiet greys, street names from zoom 14.
      let drawn = false
      map.on('style.load', () => {
        if (cancelled) return
        // The route is the athlete's own data, so it is the accent (v4.17);
        // it was coloured by pace.
        accent = readAccent()
        joined = finishShown() && finish !== null && runEndsJoined(map, start, finish)
        addRunLayers(map, {
          accent,
          ring: readRing(dark),
          route: route.slice(0, drawnRef.current),
          start,
          finish: finishShown() ? finish : null,
          joined,
          cursor: cursorRef.current,
        })
        const mode = dark ? 'dark' : 'light'
        addWaterLabels(map, { halo: SURFACES[mode].background, water: WATER_INK[mode], lang: MAP_LANG })
        addParkLabels(map, { halo: SURFACES[mode].background, park: PARK_INK[mode], lang: MAP_LANG })
        layersReadyRef.current = true
        removeFence?.()
        removeFence = addEdgeFence(map)
        if (!drawn) {
          drawn = true
          drawnRef.current = 0
          animateRoute()
        }
      })

      // A theme, or the fullscreen style button, swaps the whole style in
      // place; an accent only repaints.
      const applyStyle = (style: MapStyle) => {
        if (cancelled || (style === 'dark') === dark) return
        dark = style === 'dark'
        layersReadyRef.current = false
        removeFence?.()
        removeFence = null
        map.setStyle(maptilerStyle(dark, token), { diff: false })
      }
      applyStyleRef.current = applyStyle
      const observer = new MutationObserver(() => {
        if (cancelled || !map.isStyleLoaded()) return
        if (styleChoiceRef.current === null && isDark() !== dark) {
          applyStyle(themeStyle())
        } else if (readAccent() !== accent) {
          accent = readAccent()
          setRunAccent(map, accent)
        }
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent'] })
      stopObserving = () => observer.disconnect()
    }

    initMap()

    return () => {
      cancelled = true
      stopObserving?.()
      applyStyleRef.current = null
      removeFence?.()
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

  const m = t.activity.map
  const shownStyle = styleChoice ?? (isFullscreen ? themeStyle() : 'dark')
  const nextStyle = MAP_STYLES[(MAP_STYLES.indexOf(shownStyle) + 1) % MAP_STYLES.length]!

  const tree = (
    <div
      className={cn(
        // isolate: maplibre's z-index 20 controls would otherwise paint over the status strip.
        'activity-map relative isolate overflow-hidden rounded-xl',
        className,
        // Under the status strip, never touching the top edge (v4.8): iOS
        // kept the blur zone of a fullscreen map over the page's title.
        isFullscreen && 'activity-map-fullscreen fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[9999] h-auto rounded-none',
      )}
    >
      <div ref={hostRef} role="img" aria-label={m.routeMap} className="h-full w-full" />
      {!isFullscreen && overlay}

      {isFullscreen ? (
        <>
          {/* Full bleed (3.0): a fade under the buttons, close on the left,
              recenter and the basemap on the right, the run's card floating
              at the foot with the credits' ⓘ just above it. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-background/85 to-transparent" />
          <div className="absolute inset-x-0 top-3 z-20 flex items-start justify-between px-4">
            <button type="button" onClick={close} aria-label={m.exitFullscreen} className="map-round-button hit-44 size-[42px]">
              <X size={19} strokeWidth={2} aria-hidden="true" />
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={recenter} aria-label={m.recenter} className="map-round-button hit-44 size-[42px]">
                <LocateFixed size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setStyleChoice(nextStyle)}
                aria-label={m.style(m.styles[shownStyle])}
                data-map-style={shownStyle}
                className="map-round-button hit-44 size-[42px]"
              >
                <Layers size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-[calc(28px+var(--safe-bottom,0px))] z-20 flex flex-col items-end gap-2">
            <MapAttribution />
            {card && (
              <div
                ref={cardRef}
                data-testid="map-card"
                className="w-full rounded-[22px] border border-border bg-[color-mix(in_srgb,var(--card)_95%,transparent)] px-4 py-3.5"
              >
                {card}
              </div>
            )}
          </div>
        </>
      ) : (
        // The MapTiler and OpenStreetMap credits behind a 22 pt ⓘ (3.0).
        <MapAttribution className="absolute bottom-3 right-3 z-20" />
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
