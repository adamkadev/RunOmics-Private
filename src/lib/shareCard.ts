import type { Activity } from '@/domain/activity/types'
import { type AccentId } from '@/lib/accent'
import { isTexturedDesign, resolveDesignPalette, H, W, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
import {
  drawBackground, drawBrandMark, drawCompactHeader, drawHeader, drawOverlayStats, drawStatsCard,
  strokeRouteInCircle,
} from '@/lib/shareCardDraw'

export {
  BRAND_MARK_SRC, SHARE_DESIGNS, TEXTURED_DESIGNS, isTexturedDesign, texturedBgPath, H, W,
  type ShareDesign, type ThemeMode, type TexturedDesign,
} from '@/lib/shareCardPalette'
export { loadImage } from '@/lib/shareCardDraw'
export { projectRouteToCircle, routePathD } from '@/lib/shareCardGeometry'
export { shareCardTitle, buildStatItems, type ShareStatItem } from '@/lib/shareCardStats'

export type MapStyle = 'light' | 'dark'

export interface RenderOptions {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  theme: ThemeMode
  showMap: boolean
  photoImage?: HTMLImageElement | null
  mapImage?: HTMLImageElement | null
  texturedBgImage?: HTMLImageElement | null
  brandMarkImage?: HTMLImageElement | null
  mapStyle?: MapStyle
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { activity, design, accent, theme, showMap, photoImage, mapImage, texturedBgImage, brandMarkImage, mapStyle } = options
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const basePalette = resolveDesignPalette(design, accent, theme)
  // Day basemap: skip the accent theme entirely for the overlay text, go plain white.
  const p = design === 'map' && mapStyle === 'light' ? { ...basePalette, valueColor: '#ffffff', isLight: true } : basePalette

  ctx.clearRect(0, 0, W, H)

  const bgImage = design === 'memory' ? photoImage : design === 'map' ? mapImage : isTexturedDesign(design) ? texturedBgImage : null
  const scrim = p.isMapBg ? 'map' : p.isPhoto ? 'photo' : 'none'
  drawBackground(ctx, p, bgImage ?? null, scrim)
  // The texture designs' backgrounds already bake in the brand mark - Map's captured
  // snapshot and Memory's user photo need it stamped on top.
  if ((design === 'map' || design === 'memory') && brandMarkImage) drawBrandMark(ctx, brandMarkImage, !p.isLight)

  // Image-background designs (Map, Memory) use a smaller header and card-free stats,
  // so the map/photo underneath stays visible.
  const isOverlayStyle = p.isMapBg || p.isPhoto
  if (isOverlayStyle) drawCompactHeader(ctx, activity, p)
  else drawHeader(ctx, activity, p)

  // Route circle (not for the full-bleed map design, where the map itself shows the route)
  const hasRoute = !!activity.route && activity.route.length > 1
  if (!p.isMapBg && showMap && hasRoute) {
    strokeRouteInCircle(ctx, activity.route!, p.routeColor)
  }

  if (isOverlayStyle) drawOverlayStats(ctx, activity, p)
  else drawStatsCard(ctx, activity, p)
}

export function shareCardFileName(activity: Activity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
