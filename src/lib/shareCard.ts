import type { Activity } from '@/domain/activity/types'
import type { AccentId } from '@/lib/accent'
import { ACCENT_RGB, W, H, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
import { drawTheme, drawBranding, drawDataOverlay, drawRouteOverlay } from '@/lib/shareCardDraw'
import { rgbTriplet } from '@/lib/palette'

export {
  SHARE_DESIGNS, W, H,
  ACCENT_RGB,
  type ShareDesign, type ThemeMode,
} from '@/lib/shareCardPalette'
export { loadImage, drawTheme, drawBranding, drawDataOverlay } from '@/lib/shareCardDraw'

export interface RenderOptions {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  theme: ThemeMode
  showStats: boolean
  // On the map design: toggles real GPS vs decorative placeholder.
  // On the memory design: overlays the GPS trace on the photo/landscape.
  showMap: boolean
  photoImage?: HTMLImageElement | null
  gpsRoute?: [number, number][] | null
  locationName?: string | null
  streetLabels?: string[]
  customAccentHex?: string
  // The `route` design's basemap: the rendered tiles and the trace projected
  // onto them, or the flag saying they never arrived and the drawn `map`
  // should stand in.
  mapImage?: HTMLCanvasElement | null
  mapPoints?: [number, number][] | null
  mapFailed?: boolean
}

/** Re-exported under its historical name; the implementation lives in the palette. */
export { rgbTriplet as hexToRgb }

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions, scale = 1) {
  const { activity, design, accent, theme, showStats, showMap, photoImage, gpsRoute, locationName, streetLabels, customAccentHex, mapImage, mapPoints, mapFailed } = options
  const dark = theme === 'dark'
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (scale !== 1) ctx.scale(scale, scale)

  const [r, g, b] = customAccentHex ? rgbTriplet(customAccentHex) : ACCENT_RGB[accent][dark ? 'dark' : 'light']

  // The route design is the trace itself, so showMap never applies to it.
  const routeForTheme = design === 'map' ? (showMap ? gpsRoute : null) : gpsRoute
  drawTheme(ctx, design, W, H, r, g, b, dark, {
    gpsRoute: routeForTheme,
    photoImg: photoImage,
    locationName,
    distanceKm: activity.distanceKm,
    streetLabels,
    mapImage,
    mapPoints,
    mapFailed,
  })

  if (showMap && design === 'memory' && gpsRoute && gpsRoute.length > 1) {
    drawRouteOverlay(ctx, W, H, gpsRoute, r, g, b, dark)
  }

  drawBranding(ctx, W, H, dark)
  if (showStats) drawDataOverlay(ctx, W, H, dark, r, g, b, activity, design)
}

export function shareCardFileName(activity: Activity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
