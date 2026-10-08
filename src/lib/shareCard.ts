import type { ShareActivity } from '@/lib/shareCardStats'
import type { AccentId } from '@/lib/accentScale'
import { W, H, sharePalette, type ShareDesign, type ThemeMode } from '@/lib/shareCardPalette'
import { drawShareCard, FALLBACK_FONTS, type ShareFonts } from '@/lib/shareCardDraw'

export {
  SHARE_DESIGNS, W, H, HEADER_H, MIDDLE_H, STATS_H,
  type ShareDesign, type ThemeMode,
} from '@/lib/shareCardPalette'
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

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions, scale = 1) {
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (scale !== 1) ctx.scale(scale, scale)
  drawShareCard(ctx, {
    activity: options.activity,
    design: options.design,
    palette: sharePalette(options.accent, options.theme),
    fonts: options.fonts ?? pageFonts(),
    place: options.locationName,
    photo: options.photoImage,
    mapImage: options.mapImage,
    mapPoints: options.mapPoints,
  })
}

export function shareCardFileName(activity: ShareActivity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
