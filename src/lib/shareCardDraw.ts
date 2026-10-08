import { shareCardSubtitle, shareCardTitle, shareStats, shareZones, type ShareActivity } from '@/lib/shareCardStats'
import { HEADER_H, MIDDLE_H, W, H, type ShareDesign, type SharePalette } from '@/lib/shareCardPalette'
import { projectRoute, type LngLat } from '@/lib/shareCardMap'
import { paceAtFraction, paceRouteColor } from '@/lib/paceRoute'
import { drawMark } from '@/lib/brandMark'
import { t } from '@/i18n'
import { formatPercent } from '@/lib/formatters'

type Ctx = CanvasRenderingContext2D

/** The card's two stacks: the app's Geist for titles and numbers, the system face for the rest. */
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
/** The mark in the header lockup; small enough to take the 3-arc variant. */
const LOCKUP_MARK = 16
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

/** Lockup, title, date and place: the same on every design. */
function drawHeader(ctx: Ctx, scene: ShareCardScene) {
  const { activity, palette, fonts, place } = scene
  // The v5.2 lockup: the mark in the accent, then the wordmark in Space
  // Grotesk 700 at -0.03em, 0.36x the mark's height apart.
  ctx.textAlign = 'left'
  drawMark(ctx, PAD_X, 31.5 - LOCKUP_MARK / 2, LOCKUP_MARK, palette.acc)
  ctx.font = `700 14px ${fonts.display}`
  ctx.fillStyle = palette.mu
  ctx.textBaseline = 'middle'
  setSpacing(ctx, -0.03 * 14)
  ctx.fillText('RunOmics', PAD_X + LOCKUP_MARK * (1 + 0.36), 32)
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

  // R3 (v5.5): the main zone is the headline, and the rows spread over the
  // middle so there are no empty bands above and below them.
  const ROW = 14
  const PAD_Y = 30
  const HEAD = 34
  const rowsTop = PAD_Y + HEAD + 24
  const step = (MIDDLE_H - PAD_Y - rowsTop - ROW) / Math.max(1, zones.rows.length - 1)
  const totalMinutes = Math.round(zones.rows.reduce((sum, r) => sum + r.seconds, 0) / 60)

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `700 34px ${fonts.display}`
  ctx.fillStyle = palette.tx
  const pct = formatPercent(zones.top.percent)
  ctx.fillText(pct, PAD_X, PAD_Y + HEAD - 6)
  const pctW = ctx.measureText(pct).width
  ctx.font = `600 15px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.fillText(s.inZone(zones.top.zone), PAD_X + pctW + 8, PAD_Y + HEAD - 6)
  ctx.textAlign = 'right'
  ctx.font = `400 13px ${fonts.text}`
  ctx.fillText(s.minutes(totalMinutes), RIGHT, PAD_Y + HEAD - 6)

  ctx.textBaseline = 'middle'
  const trackX = PAD_X + 28 + 12
  const trackW = RIGHT - 52 - 12 - trackX
  zones.rows.forEach((row, i) => {
    const y = rowsTop + i * step
    const mid = y + ROW / 2
    const minutes = Math.round(row.seconds / 60)
    ctx.textAlign = 'left'
    ctx.font = `600 13px ${fonts.text}`
    ctx.fillStyle = palette.tx
    ctx.fillText(`Z${row.zone}`, PAD_X, mid)

    ctx.fillStyle = palette.fa
    roundRect(ctx, trackX, y, trackW, ROW, ROW / 2)
    ctx.fill()
    // Under a minute reads "0 min": an empty track, never a coloured dot.
    if (minutes > 0) {
      ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
      roundRect(ctx, trackX, y, Math.max(row.fill * trackW, ROW), ROW, ROW / 2)
      ctx.fill()
    }

    ctx.textAlign = 'right'
    ctx.font = minutes > 0 ? `700 13px ${fonts.text}` : `400 13px ${fonts.text}`
    ctx.fillStyle = minutes > 0 ? palette.tx : palette.mu
    ctx.fillText(s.minutes(minutes), RIGHT, mid)
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
