import type { ShareActivity } from '@/lib/shareCardStats'
import type { AccentId } from '@/lib/accentScale'
import { W, H, sharePalette, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
import { drawShareCard, FALLBACK_FONTS, shareCardLayout, type ShareFonts } from '@/lib/shareCardDraw'

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

export interface ShareCardMetrics {
  /** The route's middle: the basemap is drawn to it, so the route fills the map's whole frame. */
  middleH: number
  /** The Stats design's card, as tall as its zones. */
  statsH: number
}

/** Where there is no canvas to measure a title on. */
const UNMEASURED: ShareCardMetrics = { middleH: 400, statsH: H }

/** This run's card, laid out as drawShareCard will lay it. */
export function shareCardMetrics(activity: ShareActivity, fonts: ShareFonts): ShareCardMetrics {
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!ctx) return UNMEASURED
  return {
    middleH: shareCardLayout(ctx, activity, fonts, 'route').middleH,
    statsH: shareCardLayout(ctx, activity, fonts, 'stats').height,
  }
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions, scale = 1) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const fonts = options.fonts ?? pageFonts()
  // Sized before drawing: the Stats design is as tall as its zones.
  const { height } = shareCardLayout(ctx, options.activity, fonts, options.design)
  canvas.width = W * scale
  canvas.height = height * scale
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
  })
}

export function shareCardFileName(activity: ShareActivity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
