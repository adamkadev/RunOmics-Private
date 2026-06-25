import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear } from '@/lib/formatters'
import { shareCardTitle, buildStatItems } from '@/lib/shareCardStats'
import { projectRouteToCircle } from '@/lib/shareCardGeometry'
import {
  CR, CX, CY, H, M, MAP_BOTTOM_SCRIM_H, MAP_STATS_H, MAP_TOP_SCRIM_H, STATS_H, STATS_Y, W,
  type DesignPalette,
} from '@/lib/shareCardPalette'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height
  const br = w / h
  const sw = ir > br ? img.height * br : img.width
  const sh = ir > br ? img.height : img.width / br
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function drawBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, opacity: number) {
  if (opacity === 0) return
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  grad.addColorStop(0, color)
  grad.addColorStop(1, color + '00')
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPhotoScrims(ctx: CanvasRenderingContext2D) {
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.35)
  top.addColorStop(0, 'rgba(0,0,0,0.52)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, H * 0.35)

  const bot = ctx.createLinearGradient(0, H * 0.55, 0, H)
  bot.addColorStop(0, 'rgba(0,0,0,0)')
  bot.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = bot
  ctx.fillRect(0, H * 0.55, W, H * 0.45)
}

function drawMapScrims(ctx: CanvasRenderingContext2D) {
  const top = ctx.createLinearGradient(0, 0, 0, MAP_TOP_SCRIM_H)
  top.addColorStop(0, 'rgba(0,0,0,0.55)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, MAP_TOP_SCRIM_H)

  const bot = ctx.createLinearGradient(0, H - MAP_BOTTOM_SCRIM_H, 0, H)
  bot.addColorStop(0, 'rgba(0,0,0,0)')
  bot.addColorStop(1, 'rgba(0,0,0,0.62)')
  ctx.fillStyle = bot
  ctx.fillRect(0, H - MAP_BOTTOM_SCRIM_H, W, MAP_BOTTOM_SCRIM_H)
}

/** Fills the background: a captured/chosen image (with legibility scrims) or a flat/gradient color. */
export function drawBackground(ctx: CanvasRenderingContext2D, p: DesignPalette, bgImage: HTMLImageElement | null) {
  if (bgImage) {
    drawCover(ctx, bgImage, 0, 0, W, H)
    if (p.isMapBg) drawMapScrims(ctx)
    else drawPhotoScrims(ctx)
  } else {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
  }
}

export function drawBlobs(ctx: CanvasRenderingContext2D, p: DesignPalette) {
  if (!p.showBlobs) return
  drawBlob(ctx, W * 0.15, H * 0.18, W * 0.88, p.blob1, p.blob1Op)
  drawBlob(ctx, W * 0.88, H * 0.34, W * 0.75, p.blob2, p.blob2Op)
}

export function fillRouteCircleBg(ctx: CanvasRenderingContext2D, circleBg: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(CX, CY, CR, 0, Math.PI * 2)
  ctx.fillStyle = circleBg
  ctx.fill()
  ctx.restore()
}

export function strokeRouteInCircle(ctx: CanvasRenderingContext2D, route: [number, number][], color: string) {
  const pts = projectRouteToCircle(route, CX, CY, CR * 1.56)

  ctx.save()
  ctx.beginPath()
  ctx.arc(CX, CY, CR * 0.88, 0, Math.PI * 2)
  ctx.clip()

  ctx.beginPath()
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 10
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

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

export function drawHeader(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  ctx.save()
  ctx.translate(W - M + 8, 520)
  ctx.rotate(-Math.PI / 2)
  ctx.font = '800 26px system-ui, sans-serif'
  ctx.fillStyle = p.brandColor
  ctx.globalAlpha = 0.45
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('RUNOMICS', 0, 0)
  ctx.restore()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = '700 68px system-ui, sans-serif'
  ctx.fillStyle = p.titleColor
  const lines = wrapTitle(ctx, shareCardTitle(activity), W - M * 2 - 90)
  let y = 260
  for (const line of lines) {
    ctx.fillText(line, M, y)
    y += 80
  }

  ctx.font = '400 42px system-ui, sans-serif'
  ctx.fillStyle = p.dateColor
  ctx.fillText(formatDateWithYear(activity.date), M, y + 16)
}

/** Smaller header for the Map design, so the route stays the focal point. */
export function drawCompactHeader(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  ctx.save()
  ctx.translate(W - M + 8, 420)
  ctx.rotate(-Math.PI / 2)
  ctx.font = '800 22px system-ui, sans-serif'
  ctx.fillStyle = p.brandColor
  ctx.globalAlpha = 0.5
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('RUNOMICS', 0, 0)
  ctx.restore()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = '700 52px system-ui, sans-serif'
  ctx.fillStyle = p.titleColor
  const lines = wrapTitle(ctx, shareCardTitle(activity), W - M * 2 - 90)
  let y = 210
  for (const line of lines) {
    ctx.fillText(line, M, y)
    y += 60
  }

  ctx.font = '400 32px system-ui, sans-serif'
  ctx.fillStyle = p.dateColor
  ctx.fillText(formatDateWithYear(activity.date), M, y + 10)
}

export function drawStatsCard(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(M, STATS_Y, W - M * 2, STATS_H, 44)
  ctx.fillStyle = p.statsBg
  ctx.fill()
  ctx.strokeStyle = p.statsBorder
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  const stats = buildStatItems(activity)
  const cellW = (W - M * 2) / 2
  const PAD = 52
  const ROW_H = STATS_H / 2

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  stats.slice(0, 4).forEach((stat, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M + PAD + col * cellW
    const valueY = STATS_Y + (row === 0 ? 92 : ROW_H + 64)

    ctx.font = `800 ${stat.big ? 92 : 66}px system-ui, sans-serif`
    ctx.fillStyle = stat.big ? p.valueColor : p.secondaryColor
    ctx.fillText(stat.value, x, valueY)

    ctx.font = '600 30px system-ui, sans-serif'
    ctx.fillStyle = p.labelColor
    ctx.fillText(stat.label, x, valueY + 42)
  })
}

/** Slim single-row stats bar for the Map design, leaving most of the map visible. */
export function drawMapStatsBar(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  const y = H - M - MAP_STATS_H
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(M, y, W - M * 2, MAP_STATS_H, 32)
  ctx.fillStyle = p.statsBg
  ctx.fill()
  ctx.strokeStyle = p.statsBorder
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  const stats = buildStatItems(activity).slice(0, 4)
  const PAD = 44
  const cellW = (W - M * 2 - PAD * 2) / stats.length
  const valueY = y + 96

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  stats.forEach((stat, i) => {
    const x = M + PAD + i * cellW

    ctx.font = `800 ${stat.big ? 50 : 42}px system-ui, sans-serif`
    ctx.fillStyle = stat.big ? p.valueColor : p.secondaryColor
    ctx.fillText(stat.value, x, valueY)

    ctx.font = '600 22px system-ui, sans-serif'
    ctx.fillStyle = p.labelColor
    ctx.fillText(stat.label, x, valueY + 36)
  })
}
