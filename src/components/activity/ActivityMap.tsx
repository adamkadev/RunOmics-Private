'use client'

import { useEffect, useLayoutEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Layers, LocateFixed, MapPin, X } from 'lucide-react'
import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl'
import { cn } from '@/lib/utils'
import { basemapStyle, TEST_MAPS } from '@/lib/maptiler'
import { MapAttribution } from '@/components/ui/MapAttribution'
import { Glass, GlassLayers, GLASS_CIRCLE, GLASS_GROUP_BUTTON, glassClass } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'
import { addLandmarkLabels, addParkLabels, addWaterLabels, loadMapLibre, showPlacesAtAnyZoom } from '@/lib/maplibre'
import { SURFACES } from '@/lib/themeTokens'
import { MAP_PADDING } from '@/lib/routeFrame'
import { watchMapMoving } from '@/lib/mapMoving'
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
  /** The Charts scrub, as a share of the distance. */
  hoverFraction?: number | null
  className?: string
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  /** Drawn over the tiles and under the map's own controls while in the page. */
  overlay?: ReactNode
  card?: ReactNode
}

const noop = () => {}

const WATER_INK = { light: '#5f7f9a', dark: '#5b7d99' } as const
const PARK_INK = { light: '#5e7f65', dark: '#5f8a6d' } as const
const LANDMARK_INK = { light: '#7d6f8c', dark: '#9a8ca8' } as const
const MAP_LANG = t.locale.split('-')[0] ?? 'en'

const MAP_STYLES = ['dark', 'light'] as const
type MapStyle = (typeof MAP_STYLES)[number]

const themeStyle = (): MapStyle => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

/** Clear of the top buttons, the sides and the floating card, so the route sits in what is left. */
function fullscreenPadding(cardHeight: number) {
  const { top, right, bottom, left } = MAP_PADDING.fullscreen
  return { top, right, bottom: Math.max(bottom, cardHeight + 48), left }
}

export default function ActivityMap({ route, hoverFraction, className, fullscreen = false, onFullscreenChange = noop, overlay, card }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // The element MapLibre draws into. It moves between hosts when fullscreen
  // portals the map to <body>, so the map is resized rather than rebuilt.
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const hasMap = !!process.env.NEXT_PUBLIC_MAPTILER_TOKEN || TEST_MAPS
  const mapRef = useRef<MapLibreMap | null>(null)
  // What the run layers show, so a new style can draw them again as they were.
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

  // Leaving fullscreen puts the page back where it was, to the pixel: left 1-2 pt
  // down, iOS blurs the header under the status bar.
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
    // Refit on every toggle, or a pinch-zoom in fullscreen stays on the small map
    // with the route cut off at the card's edges.
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
    // The route's halo and the start's ring are the page behind the map: the
    // theme's --background, or the picked basemap's own page colour.
    const readRing = (darkMap: boolean) =>
      (styleChoiceRef.current === null &&
        getComputedStyle(hostRef.current ?? document.documentElement).getPropertyValue('--background').trim()) ||
      SURFACES[darkMap ? 'dark' : 'light'].background
    let removeFence: (() => void) | null = null
    let stopObserving: (() => void) | null = null

    async function initMap() {
      const mgl = await loadMapLibre()
      if (cancelled) return

      if (!basemapStyle(false)) { console.warn('NEXT_PUBLIC_MAPTILER_TOKEN not set'); return }

      const first = route[0]
      if (!first) return
      const start: LngLat = first
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
        style: basemapStyle(dark)!,
        bounds,
        fitBoundsOptions: { padding: ROUTE_FIT_PADDING, maxZoom: 15 },
        attributionControl: false,
      })
      mapRef.current = map
      // Cheaper glass over the canvas while it moves.
      watchMapMoving(map)

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

      // The first style and every one after it: the camera stays and the run comes
      // back as far as it was drawn.
      let drawn = false
      map.on('style.load', () => {
        if (cancelled) return
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
        addParkLabels(map, { halo: SURFACES[mode].background, park: PARK_INK[mode], lang: MAP_LANG })
        addLandmarkLabels(map, { halo: SURFACES[mode].background, landmark: LANDMARK_INK[mode], lang: MAP_LANG })
        addWaterLabels(map, { halo: SURFACES[mode].background, water: WATER_INK[mode], lang: MAP_LANG })
        showPlacesAtAnyZoom(map)
        layersReadyRef.current = true
        removeFence?.()
        removeFence = addEdgeFence(map)
        if (!drawn) {
          drawn = true
          drawnRef.current = 0
          animateRoute()
        }
        // iOS flips the theme and back for its app-switcher snapshots: a flip back while this style loaded went unseen.
        if (styleChoiceRef.current === null && isDark() !== dark) applyStyleRef.current?.(themeStyle())
      })

      // A theme, or the fullscreen style button, swaps the whole style in
      // place; an accent only repaints.
      const applyStyle = (style: MapStyle) => {
        if (cancelled || (style === 'dark') === dark) return
        dark = style === 'dark'
        layersReadyRef.current = false
        removeFence?.()
        removeFence = null
        map.setStyle(basemapStyle(dark)!, { diff: false })
      }
      applyStyleRef.current = applyStyle
      // Not map.isStyleLoaded(): it stays false while tiles load, long after style.load, and a flip then went unseen.
      const observer = new MutationObserver(() => {
        if (cancelled || !layersReadyRef.current) return
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

  // By distance: the charts' samples are spread by distance, the GPS points by time.
  useEffect(() => {
    cursorRef.current = hoverFraction == null ? null : pointAlongRoute(route, hoverFraction)
    const map = mapRef.current
    if (map && layersReadyRef.current) setRunCursor(map, cursorRef.current)
  }, [hoverFraction, route])

  // The overlay over the placeholder too, so the hero's edges are the same whatever it shows.
  if (!hasMap) return <><MapUnavailable className={className} />{overlay}</>

  const m = t.activity.map
  const shownStyle = styleChoice ?? (isFullscreen ? themeStyle() : 'dark')
  const nextStyle = MAP_STYLES[(MAP_STYLES.indexOf(shownStyle) + 1) % MAP_STYLES.length]!

  const tree = (
    <div
      // Fullscreen, the map holds its own glass controls, so the moving-map
      // attribute goes here; on the page it goes on the hero.
      data-map-root={isFullscreen ? '' : undefined}
      className={cn(
        // isolate: maplibre's z-index 20 controls would otherwise paint over the status strip.
        'activity-map relative isolate overflow-hidden rounded-xl',
        className,
        // Under the status strip, never touching the top edge: iOS kept the blur
        // zone of a fullscreen map over the page's title.
        isFullscreen && 'activity-map-fullscreen fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[9999] h-auto rounded-none',
      )}
    >
      <div ref={hostRef} role="img" aria-label={m.routeMap} className="h-full w-full" />
      {!isFullscreen && overlay}

      {isFullscreen ? (
        <>
          <div aria-hidden className="map-top-edge pointer-events-none absolute inset-x-0 top-0 z-10"><i /><i /></div>
          <div className="absolute inset-x-0 top-3 z-20 flex items-start justify-between px-4">
            <button type="button" onClick={close} aria-label={m.exitFullscreen} className={glassClass('regular', GLASS_CIRCLE)}>
              <GlassLayers />
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <Glass className="flex h-11">
              <button type="button" onClick={recenter} aria-label={m.recenter} className={GLASS_GROUP_BUTTON}>
                <LocateFixed size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setStyleChoice(nextStyle)}
                aria-label={m.style(m.styles[shownStyle])}
                data-map-style={shownStyle}
                className={GLASS_GROUP_BUTTON}
              >
                <Layers size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </Glass>
          </div>
          <div className="absolute inset-x-3 bottom-[calc(28px+var(--safe-bottom,0px))] z-20 flex flex-col items-end gap-2">
            <MapAttribution />
            {card && (
              <Glass
                ref={cardRef}
                data-testid="map-card"
                className="w-full rounded-[28px] px-[18px] py-3.5"
              >
                <div>{card}</div>
              </Glass>
            )}
          </div>
        </>
      ) : (
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
