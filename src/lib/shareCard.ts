import type { Activity } from '@/domain/activity/types'
import type { AccentId } from '@/lib/accent'
import { ACCENT_RGB, W, H, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
import { drawTheme, drawBranding, drawDataOverlay, drawRouteOverlay } from '@/lib/shareCardDraw'

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
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions, scale = 1) {
  const { activity, design, accent, theme, showStats, showMap, photoImage, gpsRoute } = options
  const dark = theme === 'dark'
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (scale !== 1) ctx.scale(scale, scale)

  const [r, g, b] = ACCENT_RGB[accent][dark ? 'dark' : 'light']

  // For the map design, only pass the real route when showMap is on.
  const routeForTheme = design === 'map' ? (showMap ? gpsRoute : null) : gpsRoute
  drawTheme(ctx, design, W, H, r, g, b, dark, routeForTheme, photoImage)

  // For the memory design, overlay the GPS trace on top when showMap is on.
  if (showMap && design === 'memory' && gpsRoute && gpsRoute.length > 1) {
    drawRouteOverlay(ctx, W, H, gpsRoute, r, g, b, dark, showStats)
  }

  drawBranding(ctx, W, H, dark)
  if (showStats) drawDataOverlay(ctx, W, H, dark, r, g, b, activity)
}

export function shareCardFileName(activity: Activity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
