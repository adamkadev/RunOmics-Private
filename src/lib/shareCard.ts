import type { Activity } from '@/domain/activity/types'
import { type AccentId } from '@/lib/accent'
import { resolveDesignPalette, H, W, type ShareDesign } from '@/lib/shareCardPalette'
import {
  drawBackground, drawBlobs, drawCompactHeader, drawHeader, drawMapStatsBar, drawStatsCard,
  fillRouteCircleBg, strokeRouteInCircle,
} from '@/lib/shareCardDraw'

export { SHARE_DESIGNS, H, W, type ShareDesign } from '@/lib/shareCardPalette'
export { loadImage } from '@/lib/shareCardDraw'
export { projectRouteToCircle, routePathD } from '@/lib/shareCardGeometry'
export { shareCardTitle, buildStatItems, type ShareStatItem } from '@/lib/shareCardStats'

export interface RenderOptions {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  showMap: boolean
  photoImage?: HTMLImageElement | null
  mapImage?: HTMLImageElement | null
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { activity, design, accent, showMap, photoImage, mapImage } = options
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const p = resolveDesignPalette(design, accent)

  ctx.clearRect(0, 0, W, H)

  const bgImage = design === 'memory' ? photoImage : design === 'map' ? mapImage : null
  drawBackground(ctx, p, bgImage ?? null)
  drawBlobs(ctx, p)

  if (p.isMapBg) drawCompactHeader(ctx, activity, p)
  else drawHeader(ctx, activity, p)

  // Route circle (not for the full-bleed map design, where the map itself shows the route)
  const hasRoute = !!activity.route && activity.route.length > 1
  if (!p.isMapBg && showMap) {
    fillRouteCircleBg(ctx, p.circleBg)
    if (hasRoute) strokeRouteInCircle(ctx, activity.route!, p.routeColor)
  }

  if (p.isMapBg) drawMapStatsBar(ctx, activity, p)
  else drawStatsCard(ctx, activity, p)
}

export function shareCardFileName(activity: Activity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
