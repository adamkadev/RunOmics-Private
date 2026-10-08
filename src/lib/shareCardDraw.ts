import {
  shareCardSubtitle, shareCardTitle, shareRepHero, shareStats, shareZones,
  type ShareActivity, type ShareRepHero, type ShareZones,
} from '@/lib/shareCardStats'
import { W, H, type ShareDesign, type SharePalette } from '@/lib/shareCardPalette'
import { projectRoute } from '@/lib/shareCardMap'
import { runTypeZone } from '@/lib/colors'
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

/** The title's first baseline, and the header's height when the title takes one line. */
const TITLE_BASELINE = 72
const HEADER_BASE = 136
/** 30 px, as the card has always drawn it; a title that won't sit in two lines steps down to 24. */
const TITLE_SIZES = [30, 28, 26, 24] as const
/** The stat row: value, then label, 25 px off the card's foot. */
const STATS_BLOCK = 47
const STATS_PAD_TOP = 16
const STATS_PAD_BOTTOM = 25
/** The rep pace: its eyebrow, then the pace and the target beside it. */
const HERO_PAD_TOP = 19
const HERO_BLOCK = 60
/** The Stats design's foot: a rule 31 px under the zones, the stats 22 px under it. */
const RULE_GAP = 31
const STATS_PAD_TOP_RULED = 22

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

/** The text cut to `max` px with an ellipsis: the last resort of a title, and the date line's. */
function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** A line never starts on "×" or "@", nor ends on one: "3 × 8′ @ 4:25" holds together. */
const GLUE = new Set(['×', 'x', '@', '·', '–', '-'])

/**
 * The title in one line, or two of about the same width (design review, Oct
 * 2026: text-wrap: balance, as the mock sets it) - the break that leaves
 * the longer line shortest. Null when two lines can't hold it.
 */
export function balanceLines(ctx: Ctx, text: string, max: number): string[] | null {
  if (ctx.measureText(text).width <= max) return [text]
  const words = text.split(/\s+/).filter(Boolean)
  let best: { lines: string[]; width: number; glued: boolean } | null = null
  for (let k = 1; k < words.length; k++) {
    const lines = [words.slice(0, k).join(' '), words.slice(k).join(' ')]
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width))
    if (width > max) continue
    // A break beside a joining sign is taken only when no other fits.
    const glued = GLUE.has(words[k]!) || (words[k - 1] !== '·' && GLUE.has(words[k - 1]!))
    if (!best || (best.glued && !glued) || (best.glued === glued && width < best.width)) best = { lines, width, glued }
  }
  return best?.lines ?? null
}

export interface ShareTitle {
  lines: string[]
  size: number
  lineHeight: number
}

/** The title never cut (design review, Oct 2026): two balanced lines, a size down if it must. */
function titleLines(ctx: Ctx, text: string, fonts: ShareFonts): ShareTitle {
  const max = RIGHT - PAD_X
  for (const size of TITLE_SIZES) {
    ctx.font = `700 ${size}px ${fonts.display}`
    const lines = balanceLines(ctx, text, max)
    if (lines) return { lines, size, lineHeight: Math.round(size * 1.2) }
  }
  // A name no two lines can hold: the first word that fits, the rest cut.
  const size = TITLE_SIZES[TITLE_SIZES.length - 1]!
  const words = text.split(/\s+/)
  let k = 1
  while (k < words.length && ctx.measureText(words.slice(0, k + 1).join(' ')).width <= max) k++
  const lines = [fit(ctx, words.slice(0, k).join(' '), max), fit(ctx, words.slice(k).join(' '), max)].filter(Boolean)
  return { lines, size, lineHeight: Math.round(size * 1.2) }
}

/**
 * Where everything sits (design review, Oct 2026): the header as tall as
 * its title, the stats - the rep pace above them on an interval session -
 * at the card's foot, and the middle taking all that is left, so there is
 * no empty band under the map. The Stats design is as tall as its zones
 * (design review, Oct 2026: no spacer pushing the stats down), its stats
 * under a rule; the card is then shorter than 693.
 */
export interface ShareCardLayout {
  title: ShareTitle
  hero: ShareRepHero | null
  middleTop: number
  middleH: number
  heroTop: number
  statsTop: number
  /** The rule over the stats, on the Stats design only. */
  ruleY: number | null
  height: number
}

export function shareCardLayout(ctx: Ctx, activity: ShareActivity, fonts: ShareFonts, design: ShareDesign = 'route'): ShareCardLayout {
  const title = titleLines(ctx, shareCardTitle(activity), fonts)
  const middleTop = HEADER_BASE + (title.lines.length - 1) * title.lineHeight
  const hero = shareRepHero(activity)

  if (design === 'stats') {
    const middleH = zonesHeight(ctx, shareZones(activity), fonts)
    const heroTop = middleTop + middleH + HERO_PAD_TOP
    const ruleY = (hero ? heroTop + HERO_BLOCK : middleTop + middleH) + RULE_GAP
    const statsTop = ruleY + STATS_PAD_TOP_RULED
    return { title, hero, middleTop, middleH, heroTop, statsTop, ruleY, height: statsTop + STATS_BLOCK + STATS_PAD_BOTTOM }
  }

  const statsTop = H - STATS_PAD_BOTTOM - STATS_BLOCK
  const footerTop = statsTop - STATS_PAD_TOP - (hero ? HERO_PAD_TOP + HERO_BLOCK : 0)
  return { title, hero, middleTop, middleH: footerTop - middleTop, heroTop: footerTop + HERO_PAD_TOP, statsTop, ruleY: null, height: H }
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

/** The colours the card's words take: the theme's, or white over a photo. */
interface Ink {
  tx: string
  mu: string
  mark: string
}

const PHOTO_INK: Ink = { tx: '#ffffff', mu: 'rgba(255, 255, 255, 0.85)', mark: '#ffffff' }

/** Lockup, title, date and place: the same on every design. */
function drawHeader(ctx: Ctx, { activity, fonts, place }: ShareCardScene, { title }: ShareCardLayout, ink: Ink) {
  // The v5.2 lockup: the mark, then the wordmark in Space Grotesk 700 at
  // -0.03em, 0.36x the mark's height apart.
  ctx.textAlign = 'left'
  drawMark(ctx, PAD_X, 31.5 - LOCKUP_MARK / 2, LOCKUP_MARK, ink.mark)
  ctx.font = `700 14px ${fonts.display}`
  ctx.fillStyle = ink.mu
  ctx.textBaseline = 'middle'
  setSpacing(ctx, -0.03 * 14)
  ctx.fillText('RunOmics', PAD_X + LOCKUP_MARK * (1 + 0.36), 32)
  setSpacing(ctx, 0)

  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${title.size}px ${fonts.display}`
  ctx.fillStyle = ink.tx
  title.lines.forEach((line, i) => ctx.fillText(line, PAD_X, TITLE_BASELINE + i * title.lineHeight))

  ctx.font = `400 14px ${fonts.text}`
  ctx.fillStyle = ink.mu
  const last = TITLE_BASELINE + (title.lines.length - 1) * title.lineHeight
  ctx.fillText(fit(ctx, shareCardSubtitle(activity, place), RIGHT - PAD_X), PAD_X, last + 30)
}

/** "REP PACE · 3 × 8′" in the session's zone, then the reps' pace and the plan's beside it. */
function drawHero(ctx: Ctx, { activity, palette, fonts }: ShareCardScene, hero: ShareRepHero, top: number, ink: Ink) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 15px ${fonts.text}`
  ctx.fillStyle = ink === PHOTO_INK ? ink.tx : (palette.zones[runTypeZone(activity.type) - 1] ?? ink.mu)
  setSpacing(ctx, 0.08 * 15)
  ctx.fillText(hero.eyebrow.toLocaleUpperCase(t.locale), PAD_X, top + 13)

  ctx.font = `700 44px ${fonts.display}`
  ctx.fillStyle = ink.tx
  setSpacing(ctx, -0.02 * 44)
  ctx.fillText(hero.pace, PAD_X, top + 58)
  const paceW = ctx.measureText(hero.pace).width
  setSpacing(ctx, 0)
  ctx.font = `400 17px ${fonts.text}`
  ctx.fillStyle = ink.mu
  ctx.fillText(hero.detail, PAD_X + paceW + 9, top + 58)
}

/** The start: a white ring with a dark outline, as on the Activity map. */
function startMarker(ctx: Ctx, [x, y]: [number, number], palette: SharePalette) {
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, Math.PI * 2)
  ctx.fillStyle = palette.ring
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = palette.startRing
  ctx.stroke()
}

/** The finish (design review, Oct 2026): a dark square with a white outline, never the accent. */
function finishMarker(ctx: Ctx, [x, y]: [number, number], palette: SharePalette) {
  const side = 11.5
  ctx.beginPath()
  ctx.rect(x - side / 2, y - side / 2, side, side)
  ctx.fillStyle = palette.startRing
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = palette.ring
  ctx.stroke()
}

/** Markers this far apart sit side by side, not on each other. */
const MARKER_GAP = 16

/**
 * Where the finish marker goes (always one, next to the start): the route's
 * end, or - on a loop that ends back at the start - the last point of its
 * way in that stands clear of the start's marker.
 */
function finishPoint(pts: [number, number][]): [number, number] | null {
  const [sx, sy] = pts[0]!
  for (let i = pts.length - 1; i > 0; i--) {
    const [x, y] = pts[i]!
    if (Math.hypot(x - sx, y - sy) >= MARKER_GAP) return pts[i]!
  }
  return null
}

/** How far along the line each point is, in px from the first. */
function cumulative(pts: [number, number][]): number[] {
  const at = [0]
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1]!
    const [x2, y2] = pts[i]!
    at.push(at[i - 1]! + Math.hypot(x2 - x1, y2 - y1))
  }
  return at
}

/**
 * The stretch of the line from share `from` to share `to` of its length, cut
 * where the shares fall rather than at the nearest point: a simplified route
 * keeps few points on a straight road, and a rep starts where it started.
 */
export function slicePolyline(pts: [number, number][], from: number, to: number): [number, number][] {
  const at = cumulative(pts)
  const length = at[at.length - 1]!
  if (length <= 0 || to <= from) return []
  const pointAt = (d: number): [number, number] => {
    const i = Math.max(1, at.findIndex((v) => v >= d))
    const [x1, y1] = pts[i - 1]!
    const [x2, y2] = pts[i]!
    const span = at[i]! - at[i - 1]!
    const k = span > 0 ? (d - at[i - 1]!) / span : 0
    return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]
  }
  const [a, b] = [Math.max(from, 0) * length, Math.min(to, 1) * length]
  return [pointAt(a), ...pts.filter((_, i) => at[i]! > a && at[i]! < b), pointAt(b)]
}

function strokeLine(ctx: Ctx, pts: [number, number][], color: string, width: number) {
  if (pts.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(pts[0]![0], pts[0]![1])
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y)
  ctx.stroke()
}

/** The route's widths: one trace, or the grey under reps 1.6x as wide. */
const TRACE_W = 5
const GREY_W = 4
const REP_W = GREY_W * 1.6

/** "▬ Reps", at the map's foot, on an interval session only. */
function drawRepsLegend(ctx: Ctx, { palette, fonts }: ShareCardScene, bottom: number) {
  const BAR_W = 22
  const BAR_H = 5
  const PILL_H = 28
  ctx.font = `400 13px ${fonts.text}`
  const label = t.activity.shareCard.repsLegend
  const width = 11 + BAR_W + 7 + ctx.measureText(label).width + 11
  const x = 12
  const y = bottom - 12 - PILL_H
  ctx.fillStyle = palette.bg
  roundRect(ctx, x, y, width, PILL_H, PILL_H / 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = palette.line
  ctx.stroke()
  const mid = y + PILL_H / 2
  ctx.fillStyle = palette.zones[3]!
  roundRect(ctx, x + 11, mid - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2)
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.mu
  ctx.fillText(label, x + 11 + BAR_W + 7, mid)
}

/**
 * The route on its basemap, filling the middle (design review, Oct 2026): no
 * zone colouring. One trace in the text colour, never the accent - or, on an
 * interval session, the run in grey and its reps over it in Z4's colour, as
 * wide again and more, so a rep run down the warm-up's road still shows.
 * Reps on one road merge into one line; the headline counts them.
 */
function drawRoute(ctx: Ctx, scene: ShareCardScene, { middleH }: ShareCardLayout) {
  const { activity, palette, mapImage, mapPoints } = scene
  const route = activity.route
  if (!route || route.length < 2) return
  let pts: [number, number][]
  if (mapImage && mapPoints && mapPoints.length > 1) {
    // Drawn for this middle's height; one drawn before the fonts settled the
    // title's lines is centred on it, the route moved with it.
    const drawnH = mapImage.width ? mapImage.height * (W / mapImage.width) : middleH
    const dy = (middleH - drawnH) / 2
    ctx.drawImage(mapImage, 0, dy, W, drawnH)
    pts = mapPoints.map(([x, y]) => [x, y + dy])
  } else {
    if (mapImage) ctx.drawImage(mapImage, 0, 0, W, middleH)
    pts = projectRoute(route, W, middleH)
  }

  const windows = activity.reps?.windows ?? []
  const reps = windows.length > 0
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.save()
  ctx.globalAlpha = 0.85
  strokeLine(ctx, pts, palette.casing, (reps ? GREY_W : TRACE_W) + 4)
  ctx.restore()

  if (reps) {
    strokeLine(ctx, pts, palette.mu, GREY_W)
    for (const [from, to] of windows) strokeLine(ctx, slicePolyline(pts, from, to), palette.zones[3]!, REP_W)
  } else {
    strokeLine(ctx, pts, palette.tx, TRACE_W)
  }

  // The finish under the start where the two meet.
  const finish = finishPoint(pts)
  if (finish) finishMarker(ctx, finish, palette)
  startMarker(ctx, pts[0]!, palette)

  if (reps) drawRepsLegend(ctx, scene, middleH)
}

/** The zones block: the headline's baseline, the bar under it, a row every 36 px. */
const HEADLINE_BASELINE = 60
const HEADLINE_WRAP = 26
const ZONE_BAR_H = 16
const ROWS_GAP = 31
const ROW_STEP = 36
const NO_ZONES_H = 64

/** Whether the minutes go under the headline: a long label leaves them no room beside it. */
function headlineWraps(ctx: Ctx, zones: ShareZones, fonts: ShareFonts): boolean {
  ctx.font = `700 56px ${fonts.display}`
  setSpacing(ctx, -0.03 * 56)
  let x = PAD_X + ctx.measureText(formatPercent(zones.headline.percent)).width + 10
  setSpacing(ctx, 0)
  ctx.font = `600 19px ${fonts.text}`
  x += ctx.measureText(zones.headline.label).width + 7
  ctx.font = `400 16px ${fonts.text}`
  return x + ctx.measureText(`· ${t.activity.shareCard.minutes(Math.round(zones.totalSeconds / 60))}`).width > RIGHT
}

/** How tall the zones block is: the headline, the bar, the rows, the last row's half. */
function zonesHeight(ctx: Ctx, zones: ShareZones | null, fonts: ShareFonts): number {
  if (!zones) return NO_ZONES_H
  const wrap = headlineWraps(ctx, zones, fonts) ? HEADLINE_WRAP : 0
  return HEADLINE_BASELINE + wrap + 22 + ZONE_BAR_H + ROWS_GAP + (zones.rows.length - 1) * ROW_STEP + 10
}

/**
 * Time in zones (design review, Oct 2026): the headline the run's kind is
 * judged on, one bar of the whole run in its zones, then a row for each
 * zone it spent time in, each bar its share of the run.
 */
function drawZones(ctx: Ctx, { activity, palette, fonts }: ShareCardScene, { middleH }: ShareCardLayout) {
  const s = t.activity.shareCard
  const zones = shareZones(activity)
  if (!zones) {
    ctx.font = `400 14px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.noZones, PAD_X, middleH / 2)
    return
  }

  const wraps = headlineWraps(ctx, zones, fonts)
  let y = HEADLINE_BASELINE
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 56px ${fonts.display}`
  ctx.fillStyle = palette.tx
  setSpacing(ctx, -0.03 * 56)
  const pct = formatPercent(zones.headline.percent)
  ctx.fillText(pct, PAD_X, y)
  let x = PAD_X + ctx.measureText(pct).width + 10
  setSpacing(ctx, 0)
  ctx.font = `600 19px ${fonts.text}`
  ctx.fillText(zones.headline.label, x, y)
  x += ctx.measureText(zones.headline.label).width + 7
  ctx.font = `400 16px ${fonts.text}`
  ctx.fillStyle = palette.mu
  const minutes = s.minutes(Math.round(zones.totalSeconds / 60))
  if (wraps) {
    y += HEADLINE_WRAP
    ctx.fillText(minutes, PAD_X, y)
  } else {
    ctx.fillText(`· ${minutes}`, x, y)
  }

  const BAR_H = ZONE_BAR_H
  const GAP = 5
  const barTop = y + 22
  const shown = zones.rows.reduce((sum, row) => sum + row.seconds, 0)
  const room = RIGHT - PAD_X - GAP * (zones.rows.length - 1)
  let at = PAD_X
  for (const row of zones.rows) {
    const w = Math.max((row.seconds / shown) * room, BAR_H)
    ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
    roundRect(ctx, at, barTop, w, BAR_H, BAR_H / 2)
    ctx.fill()
    at += w + GAP
  }

  const ROW_H = 9
  const rowsTop = barTop + BAR_H + ROWS_GAP
  ctx.font = `400 17px ${fonts.text}`
  const labels = zones.rows.map((row) => `Z${row.zone} ${t.zoneLabels[row.zone] ?? ''}`.trim())
  const trackX = PAD_X + Math.max(...labels.map((l) => ctx.measureText(l).width)) + 14
  const trackW = RIGHT - 48 - 12 - trackX
  ctx.textBaseline = 'middle'
  zones.rows.forEach((row, i) => {
    const mid = rowsTop + i * ROW_STEP
    ctx.textAlign = 'left'
    ctx.font = `400 17px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.fillText(labels[i]!, PAD_X, mid)

    ctx.fillStyle = palette.fa
    roundRect(ctx, trackX, mid - ROW_H / 2, trackW, ROW_H, ROW_H / 2)
    ctx.fill()
    ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
    roundRect(ctx, trackX, mid - ROW_H / 2, Math.max(row.share * trackW, ROW_H), ROW_H, ROW_H / 2)
    ctx.fill()

    ctx.textAlign = 'right'
    ctx.font = `700 17px ${fonts.text}`
    ctx.fillStyle = palette.tx
    ctx.fillText(formatPercent(Math.round(row.share * 100)), RIGHT, mid)
  })
}

/** The camera of the empty photo frame, the app's 24 px line icon at `size`. */
function camera(ctx: Ctx, cx: number, cy: number, size: number, color: string) {
  const k = size / 24
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(k, k)
  ctx.lineWidth = 1.8
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = color
  ctx.beginPath()
  for (const [i, [x, y]] of ([[4, 8], [7, 8], [9, 5], [15, 5], [17, 8], [20, 8], [20, 19], [4, 19]] as const).entries()) {
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(12, 13, 3.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** No photo yet: the frame asks for one. The sheet covers it with its own picker. */
function drawPhotoEmpty(ctx: Ctx, { palette, fonts }: ShareCardScene, { middleH }: ShareCardLayout) {
  const s = t.activity.shareCard
  ctx.fillStyle = palette.fa
  ctx.fillRect(0, 0, W, middleH)
  camera(ctx, W / 2, middleH / 2 - 30, 34, palette.tx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 16px ${fonts.text}`
  ctx.fillStyle = palette.tx
  ctx.fillText(s.choosePhoto, W / 2, middleH / 2 + 8)
  ctx.font = `400 13px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.fillText(s.photoHint, W / 2, middleH / 2 + 30)
}

/** The photo over the whole card (design review, Oct 2026), darkened at the top and foot for the words. */
function drawPhoto(ctx: Ctx, photo: HTMLImageElement) {
  drawCover(ctx, photo, W, H)
  const scrim = ctx.createLinearGradient(0, 0, 0, H)
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
  scrim.addColorStop(0.32, 'rgba(0, 0, 0, 0)')
  scrim.addColorStop(0.55, 'rgba(0, 0, 0, 0)')
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0.72)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, W, H)
}

/** Distance, Pace, Avg HR, Time: value and unit on one line, the label under it. */
function drawStats(ctx: Ctx, { activity, fonts }: ShareCardScene, top: number, ink: Ink) {
  const stats = shareStats(activity)
  const valueFont = `700 24px ${fonts.display}`
  const unitFont = `500 13px ${fonts.text}`
  const labelFont = `400 14px ${fonts.text}`
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

  ctx.textAlign = 'left'
  let x = PAD_X
  for (const { stat, valueW, width } of cells) {
    ctx.textBaseline = 'alphabetic'
    ctx.font = valueFont
    ctx.fillStyle = ink.tx
    ctx.fillText(stat.value, x, top + 21)
    if (stat.unit) {
      ctx.font = unitFont
      ctx.fillStyle = ink.mu
      ctx.fillText(stat.unit, x + valueW, top + 21)
    }
    ctx.textBaseline = 'top'
    ctx.font = labelFont
    ctx.fillStyle = ink.mu
    ctx.fillText(stat.label, x, top + 30)
    x += width + gap
  }
}

const MIDDLES: Record<ShareDesign, (ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout) => void> = {
  route: drawRoute,
  stats: drawZones,
  photo: drawPhotoEmpty,
}

/**
 * One frame for every design (v4.9): header, middle and stat row on the
 * theme's background; only the middle changes with the design, and the
 * Stats design's card is only as tall as its zones. A chosen photo takes
 * the whole card instead, the words over it in white.
 */
export function drawShareCard(ctx: Ctx, scene: ShareCardScene) {
  const layout = shareCardLayout(ctx, scene.activity, scene.fonts, scene.design)
  const { palette } = scene
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, layout.height)

  const photo = scene.design === 'photo' ? scene.photo : null
  if (photo) {
    drawPhoto(ctx, photo)
  } else {
    ctx.save()
    ctx.translate(0, layout.middleTop)
    ctx.beginPath()
    ctx.rect(0, 0, W, layout.middleH)
    ctx.clip()
    MIDDLES[scene.design](ctx, scene, layout)
    ctx.restore()
  }

  const ink = photo ? PHOTO_INK : { tx: palette.tx, mu: palette.mu, mark: palette.acc }
  if (layout.ruleY !== null) {
    ctx.fillStyle = palette.line
    ctx.fillRect(PAD_X, layout.ruleY, W - PAD_X * 2, 1)
  }
  drawHeader(ctx, scene, layout, ink)
  if (layout.hero) drawHero(ctx, scene, layout.hero, layout.heroTop, ink)
  drawStats(ctx, scene, layout.statsTop, ink)
}
