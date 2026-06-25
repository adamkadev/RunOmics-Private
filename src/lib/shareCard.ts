import type { Activity } from '@/domain/activity/types'
import { type AccentId } from '@/lib/accent'
import { resolveDesignPalette, H, W, type ShareDesign } from '@/lib/shareCardPalette'
import {
  drawBackground, drawBlobs, drawBrandBadge, drawCompactHeader, drawHeader, drawOverlayStats, drawStatsCard,
  fillRouteCircleBg, strokeRouteInCircle,
} from '@/lib/shareCardDraw'

export { SHARE_DESIGNS, H, W, type ShareDesign } from '@/lib/shareCardPalette'
export { loadImage } from '@/lib/shareCardDraw'
export { projectRouteToCircle, routePathD } from '@/lib/shareCardGeometry'
export { shareCardTitle, buildStatItems, type ShareStatItem } from '@/lib/shareCardStats'

export type MapStyle = 'light' | 'dark'

export interface RenderOptions {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  showMap: boolean
  photoImage?: HTMLImageElement | null
  mapImage?: HTMLImageElement | null
  mapStyle?: MapStyle
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { activity, design, accent, showMap, photoImage, mapImage, mapStyle } = options
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const basePalette = resolveDesignPalette(design, accent)
  // Day basemap: skip the accent theme entirely for the overlay text, go plain white.
  // isLight: true also flips the brand badge to a dark glass pill, since the bright
  // basemap would otherwise leave the white-tinted pill (and its white text) unreadable.
  const p = design === 'map' && mapStyle === 'light' ? { ...basePalette, valueColor: '#ffffff', isLight: true } : basePalette

  ctx.clearRect(0, 0, W, H)

  const bgImage = design === 'memory' ? photoImage : design === 'map' ? mapImage : null
  drawBackground(ctx, p, bgImage ?? null)
  drawBlobs(ctx, p)
  drawBrandBadge(ctx, p)

  // Image-background designs (Map, Memory) use a smaller header and card-free stats,
  // so the map/photo underneath stays visible.
  const isOverlayStyle = p.isMapBg || p.isPhoto
  if (isOverlayStyle) drawCompactHeader(ctx, activity, p)
  else drawHeader(ctx, activity, p)

  // Route circle (not for the full-bleed map design, where the map itself shows the route)
  const hasRoute = !!activity.route && activity.route.length > 1
  if (!p.isMapBg && showMap) {
    fillRouteCircleBg(ctx, p.circleBg)
    if (hasRoute) strokeRouteInCircle(ctx, activity.route!, p.routeColor)
  }

  if (isOverlayStyle) drawOverlayStats(ctx, activity, p)
  else drawStatsCard(ctx, activity, p)
}

export function shareCardFileName(activity: Activity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
