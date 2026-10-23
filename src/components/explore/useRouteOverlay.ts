'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapOverlay } from '@/components/map/useMapRoutes'
import { addRouteLayers, removeRouteLayers, setRouteData, type RouteDrawing } from './routeLayer'
import { pageAccent } from './useDistrictsOverlay'

/**
 * Several overlays as one, for `useMapRoutes`' single slot: added in order,
 * removed in reverse, so each lands over the one before it on every style
 * load. Undefined when none is given.
 */
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

/**
 * The generated loop as a `useMapRoutes` overlay: drawn on every style load
 * and accent change from the drawing current then. Undefined while `enabled`
 * is false, so the map carries no route layer outside the generator.
 */
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

/**
 * Pushes a new loop onto a map that has the layer; while it is off the map
 * (mid theme swap) the drawing is only kept, and the next draw shows it.
 */
export function useRouteSync(mapRef: RefObject<MapLibreMap | null>, mapReady: boolean, drawing: RouteDrawing | null): void {
  useEffect(() => {
    const map = mapRef.current
    if (mapReady && map) setRouteData(map, drawing)
  }, [mapRef, mapReady, drawing])
}
