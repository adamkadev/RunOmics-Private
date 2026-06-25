import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear } from '@/lib/formatters'
import { shareCardTitle, buildStatItems } from '@/lib/shareCardStats'
import { projectRouteToCircle } from '@/lib/shareCardGeometry'
import { t } from '@/i18n'
import {
  CR, CX, CY, H, M, MAP_BOTTOM_SCRIM_H, MAP_TOP_SCRIM_H, STATS_H, STATS_Y, W,
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

  // Extra dark patch behind the brand badge, so it stays legible on bright (Day) basemaps.
  const cornerSize = 480
  const corner = ctx.createRadialGradient(W, 0, 0, W, 0, cornerSize)
  corner.addColorStop(0, 'rgba(0,0,0,0.7)')
  corner.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = corner
  ctx.fillRect(W - cornerSize, 0, cornerSize, cornerSize)
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

// Scales the preview's 22x90 badge (within its 258-wide card) up to canvas size, so the
// exported PNG's brand badge matches what's shown in the live HTML/CSS preview.
const BADGE_SCALE = W / 258

/** Glass-pill brand badge, top-right - mirrors the live preview's CSS badge. */
export function drawBrandBadge(ctx: CanvasRenderingContext2D, p: DesignPalette) {
  const w = 22 * BADGE_SCALE
  const h = 90 * BADGE_SCALE
  const top = 20 * BADGE_SCALE
  const radius = 9 * BADGE_SCALE
  const x = W - w

  // Map's photographic background varies a lot more in brightness than the other
  // designs' controlled gradients, so its pill needs a more opaque glass to stay legible.
  const fillOpacity = p.isMapBg ? 0.32 : p.isLight ? 0.10 : 0.18
  const borderOpacity = p.isMapBg ? 0.45 : p.isLight ? 0.18 : 0.3

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.lineTo(x + w, top)
  ctx.lineTo(x + w, top + h)
  ctx.lineTo(x + radius, top + h)
  ctx.quadraticCurveTo(x, top + h, x, top + h - radius)
  ctx.lineTo(x, top)
  ctx.closePath()
  ctx.fillStyle = p.isLight ? `rgba(15,23,42,${fillOpacity})` : `rgba(255,255,255,${fillOpacity})`
  ctx.fill()
  ctx.strokeStyle = p.isLight ? `rgba(15,23,42,${borderOpacity})` : `rgba(255,255,255,${borderOpacity})`
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.translate(x + w / 2, top + h / 2)
  ctx.rotate(Math.PI / 2)
  ctx.font = `800 ${9.5 * BADGE_SCALE}px system-ui, sans-serif`
  ctx.fillStyle = p.brandColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('RUNOMICS', 0, 0)
  ctx.restore()
}

export function drawHeader(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
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
  const rows = [stats.slice(0, 2), stats.slice(2, 4)]
  const cellW = (W - M * 2) / 2
  const PAD_X = 52
  const VALUE_LABEL_GAP = 14
  const ROW_GAP = 36

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // Measure actual glyph metrics (rather than hardcoded offsets) so the two stat
  // rows can be centered as a block, matching the live preview's symmetric padding.
  const rowMetrics = rows.map((row) => {
    let valueAscent = 0, valueDescent = 0, labelAscent = 0, labelDescent = 0
    row.forEach((stat) => {
      ctx.font = `800 ${stat.big ? 92 : 66}px system-ui, sans-serif`
      const vm = ctx.measureText(stat.value)
      valueAscent = Math.max(valueAscent, vm.actualBoundingBoxAscent)
      valueDescent = Math.max(valueDescent, vm.actualBoundingBoxDescent)
      ctx.font = '600 30px system-ui, sans-serif'
      const lm = ctx.measureText(stat.label)
      labelAscent = Math.max(labelAscent, lm.actualBoundingBoxAscent)
      labelDescent = Math.max(labelDescent, lm.actualBoundingBoxDescent)
    })
    return { valueAscent, valueDescent, labelAscent, labelDescent, height: valueAscent + valueDescent + VALUE_LABEL_GAP + labelAscent + labelDescent }
  })

  const totalHeight = rowMetrics[0].height + ROW_GAP + rowMetrics[1].height
  let cursorY = STATS_Y + (STATS_H - totalHeight) / 2

  rows.forEach((row, r) => {
    const { valueAscent, valueDescent, labelAscent } = rowMetrics[r]
    const valueBaseline = cursorY + valueAscent
    const labelBaseline = valueBaseline + valueDescent + VALUE_LABEL_GAP + labelAscent

    row.forEach((stat, c) => {
      const x = M + PAD_X + c * cellW

      ctx.font = `800 ${stat.big ? 92 : 66}px system-ui, sans-serif`
      ctx.fillStyle = stat.big ? p.valueColor : p.secondaryColor
      ctx.fillText(stat.value, x, valueBaseline)

      ctx.font = '600 30px system-ui, sans-serif'
      ctx.fillStyle = p.labelColor
      ctx.fillText(stat.label, x, labelBaseline)
    })

    cursorY += rowMetrics[r].height + ROW_GAP
  })
}

/**
 * Image-background stats (Map, Memory): a hero distance readout plus a secondary line
 * (time · pace · avg HR), sitting directly on the bottom scrim with no card background,
 * so the map/photo stays visible.
 */
export function drawOverlayStats(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  const [hero, ...rest] = buildStatItems(activity)
  const baseline = H - M
  const heroY = rest.length ? baseline - 78 : baseline

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  if (rest.length) {
    ctx.font = '600 34px system-ui, sans-serif'
    ctx.fillStyle = p.labelColor
    ctx.fillText(rest.map((stat) => stat.value).join('   ·   '), M, baseline)
  }

  ctx.font = '800 100px system-ui, sans-serif'
  ctx.fillStyle = p.valueColor
  ctx.fillText(hero.value, M, heroY)

  const heroWidth = ctx.measureText(hero.value).width
  ctx.font = '700 36px system-ui, sans-serif'
  ctx.fillStyle = p.labelColor
  ctx.fillText(t.units.km, M + heroWidth + 16, heroY)
}
