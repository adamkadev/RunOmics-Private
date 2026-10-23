import type { Position } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { ExploreAreaFile } from '@/domain/explore/types'
import type { CameraPadding, LngLatBounds } from '@/lib/routeFrame'

/**
 * Where the camera goes when a quartier's sheet opens (S2): the quartier
 * framed in the part of the map the sheet leaves, clear of the row of
 * controls at the top. A one-off move: the padding is the camera's question,
 * never set on the map, so no later fit is padded twice (MapLibre adds a
 * map's own padding to every fit's).
 */

/** The quartier sheet's panel (its `testId`), which the camera measures. */
export const QUARTIER_SHEET_TEST_ID = 'quartier-sheet'

/** Clear of the place pill and the circles at the top of the map. */
export const QUARTIER_TOP = 72
export const QUARTIER_SIDE = 24
/** Between the quartier and the sheet's top edge. */
export const ABOVE_SHEET = 16
/** Less than this between the paddings and the quartier can't be shown: the camera stays. */
const MIN_ROOM = 48
export const QUARTIER_MAX_ZOOM = 15
export const QUARTIER_EASE_MS = 600

/** The box around one unit's shape; null for an id the area doesn't hold. */
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

/** The map's box and the open sheet's panel, in viewport pixels. */
export interface QuartierFrame {
  /** The map's box on screen (its container's client rect). */
  mapTop: number
  mapBottom: number
  /** The map's sides. Without them the panel is taken to span the map's width. */
  mapLeft?: number
  mapRight?: number
  /** Where the open sheet's panel starts, its rise left out. */
  sheetTop: number
  /**
   * The panel's other edges, when it is known not to run to the foot and
   * across: the centred sheet of a wide screen. Without them it is a bottom
   * sheet, everything under its top edge covered.
   */
  sheetBottom?: number
  sheetLeft?: number
  sheetRight?: number
}

/** The open sheet's panel on screen. */
export interface SheetBox {
  top: number
  bottom: number
  left: number
  right: number
}

/** Room left inside a padding: the box's sides, or unbounded where the frame doesn't give them. */
function roomOf(padding: CameraPadding, height: number, width: number | null): number {
  const tall = height - padding.top - padding.bottom
  const wide = width === null ? Infinity : width - padding.left - padding.right
  return Math.min(tall, wide)
}

/**
 * The room to keep around the quartier, in the largest part of the map the
 * sheet leaves free, clear of the top row: above a bottom sheet - all of the
 * map's foot under it in fullscreen, often none on the map card - and, beside
 * the centred sheet of a wide screen, the side (or the strip under it) with
 * the most room. Above a bottom sheet the top row gives way first on a map
 * mostly under the sheet; with no room left anywhere, null (the camera stays
 * where it is).
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

/**
 * The open sheet's panel on screen: its dialog layer's box plus the panel's
 * offset and size in it - layout positions both, so the 520 ms rise (a
 * transform) doesn't skew it, and a medium detent's inset, a large one, or
 * the centred sheet of a wide screen all read true. Null without a panel, or
 * one not laid out yet.
 */
export function sheetBoxOf(panel: HTMLElement | null): SheetBox | null {
  if (!panel || panel.offsetHeight === 0 || panel.offsetWidth === 0) return null
  const layer = panel.parentElement?.getBoundingClientRect()
  const top = (layer?.top ?? 0) + panel.offsetTop
  const left = (layer?.left ?? 0) + panel.offsetLeft
  return { top, bottom: top + panel.offsetHeight, left, right: left + panel.offsetWidth }
}

/**
 * Eases the camera onto the quartier's box inside `padding`: the centre and
 * zoom MapLibre works out for that room, then a plain move there - no
 * padding handed to the map. False when the box can't be framed.
 */
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
