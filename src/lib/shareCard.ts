import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { CHART_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

export type ShareTemplate = 'photo' | 'classic' | 'map' | 'transparent'

export const SHARE_TEMPLATES: ShareTemplate[] = ['photo', 'classic', 'map', 'transparent']

const WIDTH = 1080
const HEIGHT = 1920
const MARGIN = 72

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

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
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

/** "RunOmics" rotated along the right edge, anchored to the top-right corner with a margin. */
function drawVerticalBrand(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save()
  ctx.translate(WIDTH - MARGIN, MARGIN)
  ctx.rotate(Math.PI / 2)
  ctx.textBaseline = 'hanging'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillStyle = color
  ctx.fillText(`${t.brand.namePrefix}${t.brand.nameSuffix}`, 0, 0)
  ctx.restore()
}

/** Title (2 lines max) + date, leaving room on the right for the vertical brand strip. */
function drawTitleAndDate(ctx: CanvasRenderingContext2D, activity: Activity, startY: number, titleColor: string, dateColor: string) {
  const title = activity.description || t.activity.runTitle(activity.dayOfWeek)
  const maxWidth = WIDTH - MARGIN * 2 - 80

  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 60px system-ui, sans-serif'
  ctx.fillStyle = titleColor
  const lines = wrapTitle(ctx, title, maxWidth)
  let y = startY
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y)
    y += 70
  }

  ctx.font = '400 34px system-ui, sans-serif'
  ctx.fillStyle = dateColor
  ctx.fillText(formatDateWithYear(activity.date), MARGIN, y + 16)
}

/** 2-column stats grid (distance/time/pace/HR), anchored at `gridTop`. */
function drawStatsOverlay(ctx: CanvasRenderingContext2D, activity: Activity, gridTop: number, valueColor: string, labelColor: string) {
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
    ctx.fillStyle = valueColor
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

/**
 * Draws the GPS route as a vector silhouette centered in `box`.
 * TODO: swap for a real static map tile (MapTiler) + reverse-geocoded city names
 * once the visual design for the "map" template is finalized.
 */
function drawRouteShape(ctx: CanvasRenderingContext2D, route: [number, number][], box: { x: number; y: number; size: number }, color: string) {
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
  const scale = (box.size * 0.85) / Math.max(spanX, spanY)
  const offsetX = box.x + box.size / 2 - ((minX + maxX) / 2) * scale
  const offsetY = box.y + box.size / 2 - ((minY + maxY) / 2) * scale

  ctx.beginPath()
  points.forEach((p, i) => {
    const x = p.x * scale + offsetX
    const y = p.y * scale + offsetY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
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

function drawDarkBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, '#0f172a')
  gradient.addColorStop(1, '#020617')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = CHART_COLORS.brand
  ctx.fillRect(0, 0, WIDTH, 12)
}

function drawPhotoTemplate(ctx: CanvasRenderingContext2D, activity: Activity, photoImage: HTMLImageElement | null) {
  if (photoImage) {
    drawCover(ctx, photoImage, 0, 0, WIDTH, HEIGHT)
  } else {
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  const scrim = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT)
  scrim.addColorStop(0, 'rgba(2, 6, 23, 0)')
  scrim.addColorStop(1, 'rgba(2, 6, 23, 0.85)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45)

  drawTitleAndDate(ctx, activity, HEIGHT - 560, '#f8fafc', '#cbd5e1')
  drawStatsOverlay(ctx, activity, HEIGHT - 380, CHART_COLORS.brand, '#e2e8f0')
}

function drawClassicTemplate(ctx: CanvasRenderingContext2D, activity: Activity) {
  drawDarkBackground(ctx)
  drawVerticalBrand(ctx, '#f8fafc')
  drawTitleAndDate(ctx, activity, 360, '#f8fafc', '#94a3b8')
  drawStatsOverlay(ctx, activity, HEIGHT - 420, CHART_COLORS.brand, '#94a3b8')
}

function drawMapTemplate(ctx: CanvasRenderingContext2D, activity: Activity) {
  drawDarkBackground(ctx)
  drawVerticalBrand(ctx, '#f8fafc')
  drawTitleAndDate(ctx, activity, 280, '#f8fafc', '#94a3b8')

  if (activity.route && activity.route.length > 1) {
    drawRouteShape(ctx, activity.route, { x: MARGIN, y: 420, size: WIDTH - MARGIN * 2 }, CHART_COLORS.brand)
  }

  drawStatsOverlay(ctx, activity, HEIGHT - 420, CHART_COLORS.brand, '#94a3b8')
}

function drawTransparentTemplate(ctx: CanvasRenderingContext2D, activity: Activity) {
  drawVerticalBrand(ctx, '#f8fafc')
  drawTitleAndDate(ctx, activity, 360, '#f8fafc', '#cbd5e1')
  drawStatsOverlay(ctx, activity, HEIGHT - 420, CHART_COLORS.brand, '#e2e8f0')
}

/** Renders an activity share card into `canvas` (1080x1920, Canvas 2D, no external deps). */
export function renderShareCard(canvas: HTMLCanvasElement, activity: Activity, template: ShareTemplate, photoImage?: HTMLImageElement | null) {
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  if (template === 'photo') drawPhotoTemplate(ctx, activity, photoImage ?? null)
  else if (template === 'map') drawMapTemplate(ctx, activity)
  else if (template === 'transparent') drawTransparentTemplate(ctx, activity)
  else drawClassicTemplate(ctx, activity)
}

export function shareCardFileName(activity: Activity, template: ShareTemplate): string {
  return `runomics-${activity.date}-${template}.png`
}
