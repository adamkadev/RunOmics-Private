import type { ShareActivity } from '@/lib/shareCardStats'
import type { AccentId } from '@/lib/accentScale'
import { W, H, sharePalette, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
import { drawShareCard, FALLBACK_FONTS, shareCardLayout, type ShareFonts, type ShareMapLabel } from '@/lib/shareCardDraw'
import { ROUTE_TEXT_GAP, type RouteFrame } from '@/lib/shareCardMap'

export { SHARE_DESIGNS, W, H, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
export { loadImage } from '@/lib/shareCardDraw'

export interface RenderOptions {
  activity: ShareActivity
  design: ShareDesign
  accent: AccentId
  theme: ThemeMode
  photoImage?: HTMLImageElement | null
  locationName?: string | null
  mapImage?: HTMLCanvasElement | null
  mapPoints?: [number, number][] | null
  mapLabels?: ShareMapLabel[] | null
  fonts?: ShareFonts
}

/**
 * The app's own font stacks, read off the page: next/font names the families,
 * so the card can only learn them from the variables it sets.
 */
export function pageFonts(): ShareFonts {
  if (typeof document === 'undefined' || !document.body) return FALLBACK_FONTS
  const display = getComputedStyle(document.body).getPropertyValue('--font-geist').trim()
  return display ? { ...FALLBACK_FONTS, display: `${display}, ${FALLBACK_FONTS.display}` } : FALLBACK_FONTS
}

/** No canvas to measure on: every word fits, so the title takes its one line. */
const UNMEASURED = { font: '', measureText: () => ({ width: 0 }) } as unknown as CanvasRenderingContext2D

export interface ShareCardMapFrame {
  frame: RouteFrame
  /** Half way down each fade. */
  bands: [number, number]
}

/** The basemap is drawn for the whole card; the route is fitted into this frame, between the header and the stats. */
export function shareCardMapFrame(activity: ShareActivity, fonts: ShareFonts): ShareCardMapFrame {
  const ctx = (typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')) ?? UNMEASURED
  const { routeFrame, textTop, textBottom } = shareCardLayout(ctx, activity, fonts, 'route')
  const half = ROUTE_TEXT_GAP / 2
  return { frame: routeFrame, bands: [textTop + half, textBottom - half] }
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions, scale = 1) {
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const fonts = options.fonts ?? pageFonts()
  if (scale !== 1) ctx.scale(scale, scale)
  drawShareCard(ctx, {
    activity: options.activity,
    design: options.design,
    palette: sharePalette(options.accent, options.theme),
    fonts,
    place: options.locationName,
    photo: options.photoImage,
    mapImage: options.mapImage,
    mapPoints: options.mapPoints,
    mapLabels: options.mapLabels,
  })
}

export function shareCardFileName(activity: ShareActivity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
