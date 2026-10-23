'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapOverlay } from '@/components/map/useMapRoutes'
import { addRouteLayers, removeRouteLayers, setRouteData, type RouteDrawing } from './routeLayer'
import { pageAccent } from './useDistrictsOverlay'

/** For `useMapRoutes`' single slot: added in order and removed in reverse, so each lands over the one before it. */
export function combineOverlays(...overlays: readonly (MapOverlay | undefined)[]): MapOverlay | undefined {
  const present = overlays.filter((o): o is MapOverlay => o !== undefined)
  if (present.length <= 1) return present[0]
  return {
    add(map, ctx) {
      for (const overlay of present) overlay.add(map, ctx)
    },
    remove(map) {
      for (const overlay of [...present].reverse()) overlay.remove(map)
    },
  }
}

/** Drawn on every style load and accent change from the drawing current then. */
export function useRouteOverlay(drawing: RouteDrawing | null, enabled: boolean): MapOverlay | undefined {
  const drawingRef = useRef(drawing)
  useLayoutEffect(() => {
    drawingRef.current = drawing
  })
  const overlay = useMemo<MapOverlay>(
    () => ({
      add(map, { dark }) {
        setRouteData(map, drawingRef.current)
        addRouteLayers(map, { mode: dark ? 'dark' : 'light', accent: pageAccent() })
      },
      remove(map) {
        removeRouteLayers(map)
      },
    }),
    [],
  )
  return enabled ? overlay : undefined
}

/** While the layer is off the map (mid theme swap) the drawing is only kept, and the next draw shows it. */
export function useRouteSync(mapRef: RefObject<MapLibreMap | null>, mapReady: boolean, drawing: RouteDrawing | null): void {
  useEffect(() => {
    const map = mapRef.current
    if (mapReady && map) setRouteData(map, drawing)
  }, [mapRef, mapReady, drawing])
}
