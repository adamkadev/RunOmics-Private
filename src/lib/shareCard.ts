import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { ACCENT_SWATCHES, type AccentId } from '@/lib/accent'
import { t } from '@/i18n'

export type ShareStyle = 'topographic' | 'facets' | 'grain' | 'photo'
// The route as a vector silhouette ('run'), a real map tile ('map'), or hidden entirely ('none').
export type MapMode = 'run' | 'map' | 'none'
// Which background variant to load ('light' = light bg + dark text, 'dark' = dark bg + light text).
// Also drives the text color and photo scrim for the 'photo' style, which has no background variant of its own.
export type ShareTheme = 'light' | 'dark'

export const SHARE_STYLES: ShareStyle[] = ['topographic', 'facets', 'grain', 'photo']

const WIDTH = 1080
const HEIGHT = 1920
const MARGIN = 72

// Centered region (between title and stats) where the route silhouette or map tile is drawn.
export const MAP_BOX = { x: MARGIN, y: 540, w: WIDTH - MARGIN * 2, h: 760 }

interface Palette {
  title: string
  date: string
  label: string
  brand: string
}

// Title/label/brand are forced to the same color (white or black); only the date is a step grayer.
function paletteFor(theme: ShareTheme): Palette {
  return theme === 'dark'
    ? { title: '#f8fafc', date: '#cbd5e1', label: '#f8fafc', brand: '#f8fafc' }
    : { title: '#0f172a', date: '#475569', label: '#0f172a', brand: '#0f172a' }
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

export function backgroundSrc(accent: AccentId, style: Exclude<ShareStyle, 'photo'>, theme: ShareTheme): string {
  const suffix = theme === 'light' ? '-light' : ''
  return `/backgrounds/${accent}/${style}${suffix}.png`
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

/** Darkens/lightens the top and bottom of a user photo so the chosen text color stays legible. */
function drawPhotoScrims(ctx: CanvasRenderingContext2D, theme: ShareTheme) {
  const scrim = theme === 'dark' ? '2, 6, 23' : '248, 250, 252'

  const top = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.35)
  top.addColorStop(0, `rgba(${scrim}, 0.7)`)
  top.addColorStop(1, `rgba(${scrim}, 0)`)
  ctx.fillStyle = top
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.35)

  const bottom = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT)
  bottom.addColorStop(0, `rgba(${scrim}, 0)`)
  bottom.addColorStop(1, `rgba(${scrim}, 0.85)`)
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

/** Draws the map tile, cover-cropped and clipped to a rounded rectangle inside MAP_BOX. */
function drawMapTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, borderColor: string) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, 32)
  ctx.clip()
  drawCover(ctx, img, MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h)

  // Required MapTiler/OSM attribution; the offscreen map snapshot has no DOM attribution control to capture.
  ctx.font = '400 18px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillText(t.activity.shareCard.mapAttribution, MAP_BOX.x + MAP_BOX.w - 15, MAP_BOX.y + MAP_BOX.h - 13)
  ctx.textAlign = 'left'

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
  theme: ShareTheme
  mapMode: MapMode
  bgImage: HTMLImageElement | null
  mapImage?: HTMLImageElement | null
}

/** Renders an activity share card into `canvas` (1080x1920, Canvas 2D, no external deps). */
export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { activity, style, accent, theme, mapMode, bgImage, mapImage } = options
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // A user photo's lighting is unpredictable, so the 'photo' style always renders text/map/values in
  // white over a dark scrim, ignoring the theme/accent pickers (which only apply to the other styles).
  const isPhoto = style === 'photo'
  const palette = paletteFor(isPhoto ? 'dark' : theme)
  const accentHex = isPhoto ? '#ffffff' : ACCENT_SWATCHES[accent]

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  if (bgImage) drawCover(ctx, bgImage, 0, 0, WIDTH, HEIGHT)
  else if (!isPhoto) {
    // 'photo' with no image yet stays fully transparent so the empty state is obvious.
    ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#e2e8f0'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  if (isPhoto && bgImage) drawPhotoScrims(ctx, 'dark')

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
