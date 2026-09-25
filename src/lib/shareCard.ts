import type { ShareActivity } from '@/lib/shareCardStats'
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
  activity: ShareActivity
  design: ShareDesign
  accent: AccentId
  theme: ThemeMode
  showStats: boolean
  showMap: boolean
  photoImage?: HTMLImageElement | null
  gpsRoute?: [number, number][] | null
  locationName?: string | null
  streetLabels?: string[]
  customAccentHex?: string
  mapImage?: HTMLCanvasElement | null
  mapPoints?: [number, number][] | null
  mapFailed?: boolean
}

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

export function shareCardFileName(activity: ShareActivity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
