'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { AreaCoverage, ExploreAreaFile } from '@/domain/explore/types'
import { parseAccent } from '@/lib/accent'
import type { MapOverlay } from '@/components/map/useMapRoutes'
import {
  addDistrictsLayers,
  removeDistrictsLayers,
  setDistrictsData,
  setDistrictsVisible,
  setSelectedUnit,
} from './districtsLayer'

export interface DistrictsOverlayState {
  area: ExploreAreaFile | null
  coverage: AreaCoverage | null
  visible: boolean
  selectedId: string | null
}

/** The accent the page is painted in now, as the heat reads it. */
function pageAccent() {
  return parseAccent(document.documentElement.getAttribute('data-accent'))
}

/**
 * The Districts layer as a `useMapRoutes` overlay: drawn with the run layers
 * on every style load and accent change, from whatever is current then.
 * Undefined while `enabled` is false, so a map that never shows Districts
 * never gets a layer of it.
 */
export function useDistrictsOverlay(state: DistrictsOverlayState, enabled: boolean): MapOverlay | undefined {
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const overlay = useMemo<MapOverlay>(
    () => ({
      add(map, { dark }) {
        const current = stateRef.current
        addDistrictsLayers(map, {
          mode: dark ? 'dark' : 'light',
          accent: pageAccent(),
          visible: current.visible,
          selectedId: current.selectedId,
        })
        setDistrictsData(map, current.coverage, current.area)
      },
      remove(map) {
        removeDistrictsLayers(map)
      },
    }),
    [],
  )
  return enabled ? overlay : undefined
}

/**
 * Pushes new data, visibility and selection onto a map that already has the
 * layer. Every call is a no-op while the layer is off the map (mid theme
 * swap, or Districts off): the next draw reads the same state.
 */
export function useDistrictsSync(mapRef: RefObject<MapLibreMap | null>, mapReady: boolean, state: DistrictsOverlayState): void {
  const { area, coverage, visible, selectedId } = state
  useEffect(() => {
    const map = mapRef.current
    if (mapReady && map) setDistrictsData(map, coverage, area)
  }, [mapRef, mapReady, area, coverage])
  useEffect(() => {
    const map = mapRef.current
    if (mapReady && map) setDistrictsVisible(map, visible)
  }, [mapRef, mapReady, visible])
  useEffect(() => {
    const map = mapRef.current
    if (mapReady && map) setSelectedUnit(map, selectedId)
  }, [mapRef, mapReady, selectedId])
}
