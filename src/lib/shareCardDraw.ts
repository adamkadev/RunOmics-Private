import { shareCardSubtitle, shareCardTitle, shareStats, shareZones, type ShareActivity } from '@/lib/shareCardStats'
import { HEADER_H, MIDDLE_H, W, H, type ShareDesign, type SharePalette } from '@/lib/shareCardPalette'
import { projectRoute, type LngLat } from '@/lib/shareCardMap'
import { paceAtFraction, paceRouteColor } from '@/lib/paceRoute'
import { t } from '@/i18n'

type Ctx = CanvasRenderingContext2D

/** The app's two families: Space Grotesk for titles and numbers, the system face for the rest. */
export interface ShareFonts {
  display: string
  text: string
}

export const FALLBACK_FONTS: ShareFonts = {
  display: 'system-ui, sans-serif',
  text: '-apple-system, "SF Pro Text", system-ui, sans-serif',
}

export interface ShareCardScene {
  activity: ShareActivity
  design: ShareDesign
  palette: SharePalette
  fonts: ShareFonts
  place?: string | null
  photo?: HTMLImageElement | null
  /** The basemap for the middle, labels off, and the route projected onto it. */
  mapImage?: HTMLCanvasElement | null
  mapPoints?: [number, number][] | null
}

const PAD_X = 24
const RIGHT = W - PAD_X

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function setSpacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`
}

/** The text cut to `max` px with an ellipsis, so a long title keeps to its line. */
function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return }
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawCover(ctx: Ctx, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height
  const br = w / h
  const sw = ir > br ? img.height * br : img.width
  const sh = ir > br ? img.height : img.width / br
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h)
}

/** Eyebrow, title, date and place: the same on every design. */
function drawHeader(ctx: Ctx, { activity, palette, fonts, place }: ShareCardScene) {
  ctx.textAlign = 'left'
  ctx.fillStyle = palette.acc
  ctx.beginPath()
  ctx.arc(PAD_X + 4, 31.5, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = `700 11px ${fonts.display}`
  ctx.fillStyle = palette.mu
  ctx.textBaseline = 'middle'
  setSpacing(ctx, 11 * 0.16)
  ctx.fillText('RUNOMICS', PAD_X + 15, 32)
  setSpacing(ctx, 0)

  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 30px ${fonts.display}`
  ctx.fillStyle = palette.tx
  ctx.fillText(fit(ctx, shareCardTitle(activity), RIGHT - PAD_X), PAD_X, 72)

  ctx.font = `400 14px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.fillText(fit(ctx, shareCardSubtitle(activity, place), RIGHT - PAD_X), PAD_X, 102)
}

function marker(ctx: Ctx, [x, y]: [number, number], fill: string, ring: string) {
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = ring
  ctx.stroke()
}

/** The finish only gets its own marker when it isn't back at the start, as on the Activity map. */
function endsAway(route: LngLat[]): boolean {
  const first = route[0]
  const last = route[route.length - 1]
  if (!first || !last) return false
  return Math.abs(last[0] - first[0]) > 0.0005 || Math.abs(last[1] - first[1]) > 0.0005
}

/** ActivityMap's line: pace colours on a casing, white start, accent finish. */
function drawRoute(ctx: Ctx, scene: ShareCardScene) {
  const { activity, palette, mapImage, mapPoints } = scene
  const route = activity.route
  if (!route || route.length < 2) return
  if (mapImage) ctx.drawImage(mapImage, 0, 0, W, MIDDLE_H)
  const pts = mapImage && mapPoints && mapPoints.length > 1 ? mapPoints : projectRoute(route, W, MIDDLE_H)
  const first = pts[0]!
  const last = pts[pts.length - 1]!

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.strokeStyle = palette.casing
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])
  for (const [x, y] of pts) ctx.lineTo(x, y)
  ctx.stroke()
  ctx.restore()

  ctx.lineWidth = 5
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!
    const [x2, y2] = pts[i + 1]!
    ctx.strokeStyle = paceRouteColor(paceAtFraction(activity.paceSamples, i / Math.max(pts.length - 2, 1)))
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // As on the Activity map (v4.10): a white start with a dark outline, the
  // finish in the accent. No red.
  marker(ctx, first, palette.ring, palette.startRing)
  if (endsAway(route)) marker(ctx, last, palette.acc, palette.ring)
}

/** Time in zones: Z1-Z5 on a faint track, minutes beside, the main zone on top. */
function drawZones(ctx: Ctx, { activity, palette, fonts }: ShareCardScene) {
  const s = t.activity.shareCard
  ctx.fillStyle = palette.line
  ctx.fillRect(0, 0, W, 1)
  ctx.fillRect(0, MIDDLE_H - 1, W, 1)

  const zones = shareZones(activity)
  if (!zones) {
    ctx.font = `400 14px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.noZones, W / 2, MIDDLE_H / 2)
    return
  }

  const ROW = 14
  const GAP = 16
  const TITLE = 17
  const block = TITLE + 18 + zones.rows.length * ROW + (zones.rows.length - 1) * GAP
  const top = (MIDDLE_H - block) / 2

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `700 17px ${fonts.display}`
  ctx.fillStyle = palette.tx
  ctx.fillText(s.timeInZones, PAD_X, top + TITLE / 2)
  ctx.textAlign = 'right'
  ctx.font = `400 13px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.fillText(s.mostly(zones.top.zone, zones.top.percent), RIGHT, top + TITLE / 2)

  const trackX = PAD_X + 28 + 12
  const trackW = RIGHT - 52 - 12 - trackX
  zones.rows.forEach((row, i) => {
    const y = top + TITLE + 18 + i * (ROW + GAP)
    const mid = y + ROW / 2
    ctx.textAlign = 'left'
    ctx.font = `600 13px ${fonts.text}`
    ctx.fillStyle = palette.tx
    ctx.fillText(`Z${row.zone}`, PAD_X, mid)

    ctx.fillStyle = palette.fa
    roundRect(ctx, trackX, y, trackW, ROW, ROW / 2)
    ctx.fill()
    if (row.seconds > 0) {
      ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
      roundRect(ctx, trackX, y, Math.max(row.fill * trackW, ROW), ROW, ROW / 2)
      ctx.fill()
    }

    ctx.textAlign = 'right'
    ctx.font = `400 13px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.fillText(s.minutes(Math.round(row.seconds / 60)), RIGHT, mid)
  })
}

function drawPhoto(ctx: Ctx, { photo, palette, fonts }: ShareCardScene) {
  if (photo) { drawCover(ctx, photo, W, MIDDLE_H); return }
  ctx.fillStyle = palette.fa
  ctx.fillRect(0, 0, W, MIDDLE_H)
  ctx.font = `400 14px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t.activity.shareCard.photoEmpty, W / 2, MIDDLE_H / 2)
}

/** Distance, Pace, Avg HR, Time: value and unit on one line, the label under it. */
function drawStats(ctx: Ctx, { activity, palette, fonts }: ShareCardScene) {
  const stats = shareStats(activity)
  const valueFont = `700 24px ${fonts.display}`
  const unitFont = `500 12px ${fonts.text}`
  const labelFont = `400 12px ${fonts.text}`
  const cells = stats.map((stat) => {
    ctx.font = valueFont
    const valueW = ctx.measureText(stat.value).width
    ctx.font = unitFont
    const unitW = stat.unit ? ctx.measureText(stat.unit).width : 0
    ctx.font = labelFont
    const labelW = ctx.measureText(stat.label).width
    return { stat, valueW, width: Math.max(valueW + unitW, labelW) }
  })
  const used = cells.reduce((sum, c) => sum + c.width, 0)
  const gap = cells.length > 1 ? (RIGHT - PAD_X - used) / (cells.length - 1) : 0

  const top = HEADER_H + MIDDLE_H + (H - HEADER_H - MIDDLE_H - 6) / 2 - 23
  ctx.textAlign = 'left'
  let x = PAD_X
  for (const { stat, valueW, width } of cells) {
    ctx.textBaseline = 'alphabetic'
    ctx.font = valueFont
    ctx.fillStyle = palette.tx
    ctx.fillText(stat.value, x, top + 19)
    if (stat.unit) {
      ctx.font = unitFont
      ctx.fillStyle = palette.mu
      ctx.fillText(stat.unit, x + valueW, top + 19)
    }
    ctx.textBaseline = 'top'
    ctx.font = labelFont
    ctx.fillStyle = palette.mu
    ctx.fillText(stat.label, x, top + 31)
    x += width + gap
  }
}

const MIDDLES: Record<ShareDesign, (ctx: Ctx, scene: ShareCardScene) => void> = {
  route: drawRoute,
  stats: drawZones,
  photo: drawPhoto,
}

/**
 * One frame for every design (v4.9): header, a 400 px middle, the stat row,
 * all on the theme's background. Only the middle changes with the design.
 */
export function drawShareCard(ctx: Ctx, scene: ShareCardScene) {
  ctx.fillStyle = scene.palette.bg
  ctx.fillRect(0, 0, W, H)
  drawHeader(ctx, scene)

  ctx.save()
  ctx.translate(0, HEADER_H)
  ctx.beginPath()
  ctx.rect(0, 0, W, MIDDLE_H)
  ctx.clip()
  MIDDLES[scene.design](ctx, scene)
  ctx.restore()

  drawStats(ctx, scene)
}
