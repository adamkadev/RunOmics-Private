'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Map as MapLibreMap, MapMouseEvent, PointLike } from 'maplibre-gl'
import type { ExploreAreaFile } from '@/domain/explore/types'
import { DISTRICTS_FILL_LAYER } from './districtsLayer'
import { QUARTIER_SHEET_TEST_ID, easeToUnit, quartierPadding, sheetBoxOf, unitBounds } from './quartierCamera'

/** The unit drawn under a point, if the Districts fill is on the map and showing there. */
export function unitAt(map: MapLibreMap, point: PointLike): string | null {
  if (!map.getLayer(DISTRICTS_FILL_LAYER)) return null
  const id = map.queryRenderedFeatures(point, { layers: [DISTRICTS_FILL_LAYER] })[0]?.properties?.id
  return typeof id === 'string' ? id : null
}

/**
 * How long a tap on a quartier waits before its sheet opens: past the gap
 * between the two taps or clicks of a double-tap or double-click, which zoom
 * the map instead. Opened at once, the sheet's scrim took the second tap and
 * closed it, and the map never zoomed.
 */
export const TAP_OPEN_DELAY_MS = 300

/** A popover open over the map - the place pill's menu, the credits - says so on its trigger. */
const OPEN_POPOVER = '[aria-expanded="true"]'

/**
 * A tap on a quartier (S2): `onTap` with its id, once no second tap or click
 * has followed it (`TAP_OPEN_DELAY_MS`) - a double-tap or double-click zooms,
 * as it does everywhere else on the map. A tap that only closes a popover
 * over the map (the place menu, the credits) is that and nothing more, as in
 * Heat. Listens once per map, not per style - the layer comes and goes with
 * the theme, the listener stays - and asks the map what is drawn under the
 * finger, so in Heat (the layer hidden or absent) a tap is nothing. With a
 * mouse, the pointer over a quartier says it can be clicked.
 */
export function useDistrictsTap(mapRef: RefObject<MapLibreMap | null>, mapReady: boolean, onTap: (unitId: string) => void): void {
  const onTapRef = useRef(onTap)
  useLayoutEffect(() => {
    onTapRef.current = onTap
  })
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    let pending: ReturnType<typeof setTimeout> | undefined
    // Whether this gesture's press found a popover open: read before the
    // popover's own outside-press listener (on the document) closes it.
    let dismissing = false
    const cancel = () => {
      if (pending === undefined) return
      clearTimeout(pending)
      pending = undefined
    }
    const container = map.getContainer()
    const root = container.closest('[data-map-root]') ?? container
    const press = () => {
      dismissing = root.querySelector(OPEN_POPOVER) !== null
    }
    const click = (e: MapMouseEvent) => {
      cancel()
      // The second click of a double-click: the map zooms on it.
      if (dismissing || (e.originalEvent?.detail ?? 1) > 1) return
      const id = unitAt(map, e.point)
      if (!id) return
      pending = setTimeout(() => {
        pending = undefined
        onTapRef.current(id)
      }, TAP_OPEN_DELAY_MS)
    }
    const hover = (e: MapMouseEvent) => {
      const canvas = map.getCanvas()
      const cursor = unitAt(map, e.point) ? 'pointer' : ''
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor
    }
    // A second press (of a double-tap or double-click, or a drag), a zoom:
    // the tap before it opens nothing.
    const presses = ['mousedown', 'touchstart', 'dblclick', 'zoomstart'] as const
    container.addEventListener('pointerdown', press, true)
    map.on('click', click)
    map.on('mousemove', hover)
    for (const type of presses) map.on(type, cancel)
    return () => {
      cancel()
      container.removeEventListener('pointerdown', press, true)
      map.off('click', click)
      map.off('mousemove', hover)
      for (const type of presses) map.off(type, cancel)
      map.getCanvas().style.cursor = ''
    }
  }, [mapRef, mapReady])
}

/**
 * When a quartier's sheet opens, the camera eases so the quartier sits in
 * the map the sheet leaves: measured on the sheet's panel and the map's box,
 * then one move to the centre and zoom that frame it. Nothing to undo on
 * close - the map keeps no padding.
 */
export function useQuartierCamera(
  mapRef: RefObject<MapLibreMap | null>,
  mapReady: boolean,
  unitId: string | null,
  area: ExploreAreaFile | null,
): void {
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !unitId) return
    const bounds = unitBounds(area, unitId)
    if (!bounds) return
    const box = map.getContainer().getBoundingClientRect()
    // No sheet on screen (it hasn't mounted or been laid out): frame it over the whole map.
    const sheet = sheetBoxOf(document.querySelector<HTMLElement>(`[data-testid="${QUARTIER_SHEET_TEST_ID}"]`))
    const padding = quartierPadding({
      mapTop: box.top,
      mapBottom: box.bottom,
      mapLeft: box.left,
      mapRight: box.right,
      sheetTop: sheet?.top ?? box.bottom,
      sheetBottom: sheet?.bottom,
      sheetLeft: sheet?.left,
      sheetRight: sheet?.right,
    })
    if (!padding) return
    easeToUnit(map, bounds, padding, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  }, [mapRef, mapReady, unitId, area])
}
