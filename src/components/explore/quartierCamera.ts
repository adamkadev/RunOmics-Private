import type { Position } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { ExploreAreaFile } from '@/domain/explore/types'
import type { CameraPadding, LngLatBounds } from '@/lib/routeFrame'

export const QUARTIER_SHEET_TEST_ID = 'quartier-sheet'

/** Clear of the place pill and the circles at the top of the map. */
export const QUARTIER_TOP = 72
export const QUARTIER_SIDE = 24
/** Between the quartier and the sheet's top edge. */
export const ABOVE_SHEET = 16
/** Less room than this and the camera stays where it is. */
const MIN_ROOM = 48
export const QUARTIER_MAX_ZOOM = 15
export const QUARTIER_EASE_MS = 600

export function unitBounds(area: ExploreAreaFile | null, id: string): LngLatBounds | null {
  const feature = area?.features.find((f) => f.properties.id === id)
  if (!feature) return null
  const box = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity }
  const visit = (ring: Position[]) => {
    for (const [lon, lat] of ring) {
      if (lon === undefined || lat === undefined) continue
      if (lon < box.minLon) box.minLon = lon
      if (lon > box.maxLon) box.maxLon = lon
      if (lat < box.minLat) box.minLat = lat
      if (lat > box.maxLat) box.maxLat = lat
    }
  }
  const { geometry } = feature
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons) for (const ring of polygon) visit(ring)
  return Number.isFinite(box.minLon) ? box : null
}

/** In viewport pixels. */
export interface QuartierFrame {
  mapTop: number
  mapBottom: number
  /** Without them the panel is taken to span the map's width. */
  mapLeft?: number
  mapRight?: number
  /** The panel's top, its rise animation left out. */
  sheetTop: number
  /** Only for the centred sheet of a wide screen; without them it is a bottom sheet. */
  sheetBottom?: number
  sheetLeft?: number
  sheetRight?: number
}

export interface SheetBox {
  top: number
  bottom: number
  left: number
  right: number
}

function roomOf(padding: CameraPadding, height: number, width: number | null): number {
  const tall = height - padding.top - padding.bottom
  const wide = width === null ? Infinity : width - padding.left - padding.right
  return Math.min(tall, wide)
}

/**
 * The roomiest part of the map the sheet leaves free, clear of the top row; null when none has room.
 * Above a bottom sheet the top row gives way first.
 */
export function quartierPadding(frame: QuartierFrame): CameraPadding | null {
  const { mapTop, mapBottom, sheetTop } = frame
  const height = mapBottom - mapTop
  const width = frame.mapLeft !== undefined && frame.mapRight !== undefined ? frame.mapRight - frame.mapLeft : null
  // A map scrolled partly off the top: its hidden strip counts as the row's.
  const rowTop = Math.max(QUARTIER_TOP, -mapTop + ABOVE_SHEET)
  const side = { left: QUARTIER_SIDE, right: QUARTIER_SIDE }
  const regions: CameraPadding[] = []

  // Above the panel.
  const overlap = Math.min(height, Math.max(0, mapBottom - sheetTop))
  const bottom = overlap + ABOVE_SHEET
  let top = rowTop
  if (height - top - bottom < MIN_ROOM) top = Math.max(0, height - bottom - MIN_ROOM)
  regions.push({ top, bottom, ...side })

  // Under a panel that stops short of the map's foot.
  if (frame.sheetBottom !== undefined && frame.sheetBottom < mapBottom) {
    regions.push({ top: Math.max(rowTop, frame.sheetBottom - mapTop + ABOVE_SHEET), bottom: ABOVE_SHEET, ...side })
  }
  // Beside a panel narrower than the map, over the map's height under the row.
  if (frame.mapLeft !== undefined && frame.mapRight !== undefined && sheetTop < mapBottom && (frame.sheetBottom ?? mapBottom) > mapTop) {
    const { mapLeft, mapRight } = frame
    if (frame.sheetLeft !== undefined && frame.sheetLeft > mapLeft) {
      regions.push({ top: rowTop, bottom: ABOVE_SHEET, left: QUARTIER_SIDE, right: Math.max(QUARTIER_SIDE, mapRight - frame.sheetLeft + ABOVE_SHEET) })
    }
    if (frame.sheetRight !== undefined && frame.sheetRight < mapRight) {
      regions.push({ top: rowTop, bottom: ABOVE_SHEET, left: Math.max(QUARTIER_SIDE, frame.sheetRight - mapLeft + ABOVE_SHEET), right: QUARTIER_SIDE })
    }
  }

  // The roomiest; on a tie the first (above the sheet).
  let best: CameraPadding | null = null
  let bestRoom = MIN_ROOM - 1
  for (const region of regions) {
    const room = roomOf(region, height, width)
    if (room > bestRoom) {
      best = region
      bestRoom = room
    }
  }
  return best ? { top: best.top, right: best.right, bottom: best.bottom, left: best.left } : null
}

/** Layout offsets rather than the panel's own rect, so the rise (a transform) doesn't skew it. */
export function sheetBoxOf(panel: HTMLElement | null): SheetBox | null {
  if (!panel || panel.offsetHeight === 0 || panel.offsetWidth === 0) return null
  const layer = panel.parentElement?.getBoundingClientRect()
  const top = (layer?.top ?? 0) + panel.offsetTop
  const left = (layer?.left ?? 0) + panel.offsetLeft
  return { top, bottom: top + panel.offsetHeight, left, right: left + panel.offsetWidth }
}

/** The padding is never handed to the map: MapLibre adds a map's own padding to every later fit. */
export function easeToUnit(map: MapLibreMap, bounds: LngLatBounds, padding: CameraPadding, reduceMotion = false): boolean {
  const camera = map.cameraForBounds(
    [
      [bounds.minLon, bounds.minLat],
      [bounds.maxLon, bounds.maxLat],
    ],
    { padding, maxZoom: QUARTIER_MAX_ZOOM },
  )
  if (!camera?.center) return false
  map.easeTo({ center: camera.center, zoom: camera.zoom, duration: reduceMotion ? 0 : QUARTIER_EASE_MS })
  return true
}
