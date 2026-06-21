import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { ACCENT_SWATCHES, type AccentId } from '@/lib/accent'
import { t } from '@/i18n'

export type ShareStyle = 'topographic' | 'facets' | 'grain' | 'photo'
// The route as a vector silhouette ('run'), a real map tile ('map'), or hidden entirely ('none').
export type MapMode = 'run' | 'map' | 'none'

export const SHARE_STYLES: ShareStyle[] = ['topographic', 'facets', 'grain', 'photo']
// Styles with a light background need dark text; the rest are dark and need light text.
const LIGHT_STYLES = new Set<ShareStyle>(['topographic', 'facets'])

// 'photo' lets the user supply their own background; this is shown until they pick one.
export const PHOTO_PLACEHOLDER = '/backgrounds/_demo-photo.png'

const WIDTH = 1080
const HEIGHT = 1920
const MARGIN = 72

// Centered region (between title and stats) where the route silhouette or map tile is drawn.
const MAP_BOX = { x: MARGIN, y: 540, w: WIDTH - MARGIN * 2, h: 760 }

interface Palette {
  title: string
  date: string
  label: string
  brand: string
}

function paletteFor(style: ShareStyle): Palette {
  return LIGHT_STYLES.has(style)
    ? { title: '#0f172a', date: '#475569', label: '#475569', brand: '#334155' }
    : { title: '#f8fafc', date: '#cbd5e1', label: '#e2e8f0', brand: '#f8fafc' }
}

interface StatCell {
  label: string
  value: string
}

function buildShareStats(activity: Activity): StatCell[] {
  const stats: StatCell[] = [
    { label: t.activity.shareCard.distance, value: formatDistance(activity.distanceKm) },
    { label: t.activity.shareCard.time, value: formatDuration(activity.durationSeconds) },
  ]
  if (activity.paceSecPerKm) {
    stats.push({ label: t.activity.shareCard.pace, value: formatPace(activity.paceSecPerKm) })
  }
  if (activity.avgHeartRate) {
    stats.push({ label: t.activity.shareCard.avgHr, value: `${activity.avgHeartRate} ${t.units.bpm}` })
  }
  return stats
}

export function backgroundSrc(accent: AccentId, style: ShareStyle): string {
  return `/backgrounds/${accent}/${style}.png`
}

export function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

/** Caps `route` at `max` points (keeping the last), to keep the static-map URL short. */
function downsample(route: [number, number][], max: number): [number, number][] {
  if (route.length <= max) return route
  const step = (route.length - 1) / (max - 1)
  const out: [number, number][] = []
  for (let i = 0; i < max; i++) out.push(route[Math.round(i * step)])
  return out
}

/**
 * Builds a MapTiler Static Maps URL rendering the run's GPS track as a colored path.
 * Returns null when there is no usable route or token.
 */
export function staticMapUrl(activity: Activity, accent: AccentId, isDark: boolean, token: string | undefined): string | null {
  if (!token || !activity.route || activity.route.length < 2) return null
  const style = isDark ? 'backdrop-v4-dark' : 'dataviz-v4'
  const coords = downsample(activity.route, 90)
    .map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`)
    .join('|')
  const path = `stroke:${ACCENT_SWATCHES[accent]}|width:6|${coords}`
  const w = Math.round(MAP_BOX.w / 2)
  const h = Math.round(MAP_BOX.h / 2)
  return `https://api.maptiler.com/maps/${style}/static/auto/${w}x${h}@2x.png?key=${token}&padding=60&path=${encodeURIComponent(path)}`
}

/** Wraps text to fit `maxWidth`, capped at two lines (second line gets an ellipsis). */
function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === 2) break
    } else {
      line = candidate
    }
  }
  if (line && lines.length < 2) lines.push(line)

  if (lines.length === 2 && ctx.measureText(lines[1]).width > maxWidth) {
    while (lines[1].length > 1 && ctx.measureText(`${lines[1]}…`).width > maxWidth) {
      lines[1] = lines[1].slice(0, -1)
    }
    lines[1] = `${lines[1]}…`
  }
  return lines
}

/** "RunOmics" rotated along the right edge, anchored to the top-right corner with a margin. */
function drawVerticalBrand(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save()
  ctx.translate(WIDTH - MARGIN, MARGIN + 40)
  ctx.rotate(Math.PI / 2)
  ctx.textBaseline = 'hanging'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillStyle = color
  ctx.fillText(`${t.brand.namePrefix}${t.brand.nameSuffix}`, 0, 0)
  ctx.restore()
}

/** Title (2 lines max) + date, leaving room on the right for the vertical brand strip. */
function drawTitleAndDate(ctx: CanvasRenderingContext2D, activity: Activity, startY: number, palette: Palette) {
  const title = activity.description || t.activity.runTitle(activity.dayOfWeek)
  const maxWidth = WIDTH - MARGIN * 2 - 80

  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 60px system-ui, sans-serif'
  ctx.fillStyle = palette.title
  const lines = wrapTitle(ctx, title, maxWidth)
  let y = startY
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y)
    y += 70
  }

  ctx.font = '400 34px system-ui, sans-serif'
  ctx.fillStyle = palette.date
  ctx.fillText(formatDateWithYear(activity.date), MARGIN, y + 16)
}

/** 2-column stats grid (distance/time/pace/HR), anchored at `gridTop`. */
function drawStatsOverlay(ctx: CanvasRenderingContext2D, activity: Activity, gridTop: number, accentHex: string, labelColor: string) {
  const stats = buildShareStats(activity)
  const cols = 2
  const cellWidth = (WIDTH - MARGIN * 2) / cols
  const rowHeight = 190

  stats.forEach((stat, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = MARGIN + col * cellWidth
    const y = gridTop + row * rowHeight

    ctx.font = '700 76px system-ui, sans-serif'
    ctx.fillStyle = accentHex
    ctx.fillText(stat.value, x, y)

    ctx.font = '600 28px system-ui, sans-serif'
    ctx.fillStyle = labelColor
    ctx.fillText(stat.label, x, y + 40)
  })
}

function projectRoute(route: [number, number][]): { x: number; y: number }[] {
  const avgLat = route.reduce((sum, [, lat]) => sum + lat, 0) / route.length
  const cos = Math.cos((avgLat * Math.PI) / 180)
  // Equirectangular approximation, fine at the scale of a single run's bounding box.
  // Canvas y grows downward, latitude grows northward, so it's negated.
  return route.map(([lng, lat]) => ({ x: lng * cos, y: -lat }))
}

/** Draws the GPS route as a vector silhouette centered in `box`. */
function drawRouteShape(ctx: CanvasRenderingContext2D, route: [number, number][], color: string) {
  const points = projectRoute(route)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const scale = (Math.min(MAP_BOX.w, MAP_BOX.h) * 0.82) / Math.max(spanX, spanY)
  const offsetX = MAP_BOX.x + MAP_BOX.w / 2 - ((minX + maxX) / 2) * scale
  const offsetY = MAP_BOX.y + MAP_BOX.h / 2 - ((minY + maxY) / 2) * scale

  ctx.beginPath()
  points.forEach((p, i) => {
    const x = p.x * scale + offsetX
    const y = p.y * scale + offsetY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

function drawPhotoScrims(ctx: CanvasRenderingContext2D) {
  const top = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.35)
  top.addColorStop(0, 'rgba(2, 6, 23, 0.7)')
  top.addColorStop(1, 'rgba(2, 6, 23, 0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.35)

  const bottom = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT)
  bottom.addColorStop(0, 'rgba(2, 6, 23, 0)')
  bottom.addColorStop(1, 'rgba(2, 6, 23, 0.85)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4)
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height
  const boxRatio = w / h
  const isWider = imgRatio > boxRatio
  const sh = isWider ? img.height : img.width / boxRatio
  const sw = isWider ? sh * boxRatio : img.width
  const sx = isWider ? (img.width - sw) / 2 : 0
  const sy = isWider ? 0 : (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** Draws the static map tile, cover-cropped and clipped to a rounded rectangle inside MAP_BOX. */
function drawMapTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, borderColor: string) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, 32)
  ctx.clip()
  drawCover(ctx, img, MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h)
  ctx.restore()

  ctx.beginPath()
  ctx.roundRect(MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, 32)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 3
  ctx.stroke()
}

export interface RenderOptions {
  activity: Activity
  style: ShareStyle
  accent: AccentId
  mapMode: MapMode
  bgImage: HTMLImageElement | null
  mapImage?: HTMLImageElement | null
}

/** Renders an activity share card into `canvas` (1080x1920, Canvas 2D, no external deps). */
export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { activity, style, accent, mapMode, bgImage, mapImage } = options
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const palette = paletteFor(style)
  const accentHex = ACCENT_SWATCHES[accent]

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  if (bgImage) drawCover(ctx, bgImage, 0, 0, WIDTH, HEIGHT)
  else {
    ctx.fillStyle = LIGHT_STYLES.has(style) ? '#e2e8f0' : '#0f172a'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  // A user photo can be bright anywhere; darken top and bottom so white text stays legible.
  if (style === 'photo') drawPhotoScrims(ctx)

  drawVerticalBrand(ctx, palette.brand)
  drawTitleAndDate(ctx, activity, 320, palette)

  if (mapMode === 'map' && mapImage) {
    drawMapTile(ctx, mapImage, palette.label)
  } else if (mapMode !== 'none' && activity.route && activity.route.length > 1) {
    // Falls back to the vector silhouette while the 'map' tile is still loading.
    drawRouteShape(ctx, activity.route, accentHex)
  }

  drawStatsOverlay(ctx, activity, HEIGHT - 400, accentHex, palette.label)
}

export function shareCardFileName(activity: Activity, style: ShareStyle): string {
  return `runomics-${activity.date}-${style}.png`
}
