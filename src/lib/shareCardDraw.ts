import {
  shareCardSubtitle, shareCardTitle, shareRepDetail, shareRepHero, shareStats, shareStructure, shareZones, zoneName,
  type ShareActivity, type ShareRepDetail, type ShareRepHero, type ShareVerdict, type ShareZoneRow,
} from '@/lib/shareCardStats'
import { W, H, type ShareDesign, type SharePalette } from '@/lib/shareCardPalette'
import { projectRoute, ROUTE_INSET, ROUTE_TEXT_GAP, type RouteFrame } from '@/lib/shareCardMap'
import { runTypeZone } from '@/lib/colors'

function repColor(activity: ShareActivity, palette: SharePalette): string {
  return palette.zones[runTypeZone(activity.type) - 1] ?? palette.zones[3]!
}
import { drawRouteMarker, endsJoined, routeEnds } from '@/lib/routeMarkers'
import { drawMark } from '@/lib/brandMark'
import { t } from '@/i18n'
import { formatPercent } from '@/lib/formatters'

type Ctx = CanvasRenderingContext2D

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
  /** Drawn for the layout's route frame; mapPoints is the route projected onto it. */
  mapImage?: HTMLCanvasElement | null
  mapPoints?: [number, number][] | null
  /** As MapLibre placed them, drawn over the route. */
  mapLabels?: ShareMapLabel[] | null
}

/** In the card's px. */
export interface ShareMapLabel {
  text: string
  x: number
  y: number
  size: number
  color: string
  opacity: number
}

const PAD_X = 16
/** Small enough to take the 3-arc variant. */
const LOCKUP_MARK = 12
/** The run is the card's subject, not the brand. */
const LOCKUP_ALPHA = 0.8
const LOCKUP_Y = 21
const RIGHT = W - PAD_X

const TITLE_BASELINE = 50
/** The header's height when the title takes one line. */
const HEADER_BASE = 79
const TITLE_SIZES = [19, 18, 17, 16] as const
const STATS_BLOCK = 32
const STATS_PAD_TOP = 12
const STATS_PAD_BOTTOM = 16
const HERO_PAD_TOP = 12
const HERO_BLOCK = 42
const HERO_PACE_SIZE = 32
const CHIP_H = 16
const BAR_MAX = 16
const REP_DETAIL_PAD_TOP = 8
const REP_DETAIL_H = { chips: CHIP_H, bars: BAR_MAX + 12 } as const
const STATS_PAD_TOP_AFTER_HERO = 16
/** The card is a phone map's width less its margins. */
const MARKER_SCALE = 0.85

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

function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** A line never starts on "×" or "@", nor ends on one: "3 × 8′ @ 4:25" holds together. */
const GLUE = new Set(['×', 'x', '@', '·', '–', '-'])

/** As text-wrap: balance sets two lines: the break that leaves the longer line shortest. */
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

export interface ShareCardLayout {
  title: ShareTitle
  hero: ShareRepHero | null
  repDetail: ShareRepDetail | null
  repDetailTop: number
  middleTop: number
  middleH: number
  heroTop: number
  statsTop: number
  /** Null on a photo, which runs under the stat row. */
  ruleY: number | null
  /** The foot of the header's words. */
  textTop: number
  /** The top of the stats, or of the rep pace over them. */
  textBottom: number
  routeFrame: RouteFrame
}

export function shareCardLayout(ctx: Ctx, activity: ShareActivity, fonts: ShareFonts, design: ShareDesign = 'route'): ShareCardLayout {
  const title = titleLines(ctx, shareCardTitle(activity), fonts)
  const middleTop = HEADER_BASE + (title.lines.length - 1) * title.lineHeight
  const hero = shareRepHero(activity)
  const repDetail = hero ? shareRepDetail(activity) : null
  const detailH = repDetail ? REP_DETAIL_PAD_TOP + REP_DETAIL_H[repDetail.kind] : 0
  const statsTop = H - STATS_PAD_BOTTOM - STATS_BLOCK
  const stripTop = statsTop - (hero ? STATS_PAD_TOP_AFTER_HERO : STATS_PAD_TOP)
  const footerTop = stripTop - (hero ? HERO_PAD_TOP + HERO_BLOCK + detailH : 0)
  const textTop = headerFoot({ title })
  return {
    title,
    hero,
    repDetail,
    repDetailTop: footerTop + HERO_PAD_TOP + HERO_BLOCK + REP_DETAIL_PAD_TOP,
    middleTop,
    middleH: footerTop - middleTop,
    heroTop: footerTop + HERO_PAD_TOP,
    statsTop,
    // Clear of the rep pace's digits when it stands over the stat row.
    ruleY: design === 'photo' ? null : stripTop + (hero ? 7 : 0),
    textTop,
    textBottom: footerTop,
    routeFrame: { top: textTop + ROUTE_TEXT_GAP, right: ROUTE_INSET, bottom: H - footerTop + ROUTE_TEXT_GAP, left: ROUTE_INSET },
  }
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

interface Ink {
  tx: string
  mu: string
  mark: string
}

const PHOTO_INK: Ink = { tx: '#ffffff', mu: 'rgba(255, 255, 255, 0.85)', mark: '#ffffff' }

function drawHeader(ctx: Ctx, { activity, fonts, place }: ShareCardScene, { title }: ShareCardLayout, ink: Ink) {
  ctx.textAlign = 'left'
  ctx.save()
  ctx.globalAlpha = LOCKUP_ALPHA
  drawMark(ctx, PAD_X, LOCKUP_Y - LOCKUP_MARK / 2, LOCKUP_MARK, ink.mark)
  ctx.font = `700 10.5px ${fonts.display}`
  ctx.fillStyle = ink.mu
  ctx.textBaseline = 'middle'
  setSpacing(ctx, -0.03 * 10.5)
  ctx.fillText('RunOmics', PAD_X + LOCKUP_MARK + 5, LOCKUP_Y)
  setSpacing(ctx, 0)
  ctx.restore()

  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${title.size}px ${fonts.display}`
  ctx.fillStyle = ink.tx
  setSpacing(ctx, -0.01 * title.size)
  title.lines.forEach((line, i) => ctx.fillText(line, PAD_X, TITLE_BASELINE + i * title.lineHeight))
  setSpacing(ctx, 0)

  const last = TITLE_BASELINE + (title.lines.length - 1) * title.lineHeight
  const rest = shareCardSubtitle(activity, place)
  const structure = shareStructure(activity)
  let x = PAD_X
  if (structure) {
    ctx.font = `600 10px ${fonts.text}`
    ctx.fillStyle = ink.tx
    ctx.fillText(structure, x, last + 18)
    x += ctx.measureText(`${structure} · `).width
  }
  ctx.font = `400 10px ${fonts.text}`
  ctx.fillStyle = ink.mu
  if (structure) ctx.fillText(' · ', x - ctx.measureText(' · ').width, last + 18)
  ctx.fillText(fit(ctx, rest, RIGHT - x), x, last + 18)
}

function drawHero(ctx: Ctx, { activity, palette, fonts }: ShareCardScene, hero: ShareRepHero, top: number, ink: Ink) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 9.5px ${fonts.text}`
  ctx.fillStyle = ink === PHOTO_INK ? ink.tx : repColor(activity, palette)
  setSpacing(ctx, 0.08 * 9.5)
  ctx.fillText(hero.eyebrow.toLocaleUpperCase(t.locale), PAD_X, top + 9)

  ctx.font = `700 ${HERO_PACE_SIZE}px ${fonts.display}`
  ctx.fillStyle = ink.tx
  setSpacing(ctx, -0.03 * HERO_PACE_SIZE)
  ctx.fillText(hero.pace, PAD_X, top + 40)
  let x = PAD_X + ctx.measureText(hero.pace).width + 5
  setSpacing(ctx, 0)
  ctx.font = `400 11px ${fonts.text}`
  ctx.fillStyle = ink.mu
  ctx.fillText(hero.unit, x, top + 40)
  if (hero.target) {
    x += ctx.measureText(hero.unit).width + 7
    ctx.font = `400 9.5px ${fonts.text}`
    ctx.fillText(hero.target, x, top + 40)
  }
}

function drawRepDetail(ctx: Ctx, { activity, fonts, palette }: ShareCardScene, detail: ShareRepDetail, top: number, ink: Ink) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (detail.kind === 'chips') {
    let x = PAD_X
    for (const chip of detail.chips) {
      ctx.font = `400 9px ${fonts.text}`
      const labelW = ctx.measureText(`${chip.label} `).width
      ctx.font = `600 9px ${fonts.text}`
      const width = 8 + labelW + ctx.measureText(chip.pace).width + 8
      ctx.fillStyle = palette.card
      roundRect(ctx, x, top, width, CHIP_H, 5)
      ctx.fill()
      ctx.font = `400 9px ${fonts.text}`
      ctx.fillStyle = ink.mu
      ctx.fillText(chip.label, x + 8, top + CHIP_H / 2)
      ctx.font = `600 9px ${fonts.text}`
      ctx.fillStyle = ink.tx
      ctx.fillText(chip.pace, x + 8 + labelW, top + CHIP_H / 2)
      x += width + 6
    }
    ctx.textBaseline = 'alphabetic'
    return
  }
  const gap = 3
  const width = Math.min(120, detail.bars.length * 8)
  const barW = Math.max(2, (width - gap * (detail.bars.length - 1)) / detail.bars.length)
  ctx.fillStyle = repColor(activity, palette)
  detail.bars.forEach((share, i) => {
    const h = Math.max(2, Math.round(BAR_MAX * (0.35 + 0.65 * share)))
    ctx.fillRect(PAD_X + i * (barW + gap), top + BAR_MAX - h, barW, h)
  })
  ctx.textBaseline = 'alphabetic'
  ctx.font = `400 9px ${fonts.text}`
  ctx.fillStyle = ink.mu
  ctx.fillText(detail.range, PAD_X, top + BAR_MAX + 11)
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

function cumulative(pts: [number, number][]): number[] {
  const at = [0]
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1]!
    const [x2, y2] = pts[i]!
    at.push(at[i - 1]! + Math.hypot(x2 - x1, y2 - y1))
  }
  return at
}

/** Cut where the shares fall, not at the nearest point: a simplified route keeps few points on a straight road. */
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

const TRACE_W = 3
const GREY_W = 2.5
const REP_W = GREY_W * 1.6

function drawRepsLegend(ctx: Ctx, { activity, palette, fonts }: ShareCardScene, top: number) {
  const BAR_W = 14
  const BAR_H = 3
  const PILL_H = 18
  ctx.font = `400 9px ${fonts.text}`
  const label = t.activity.shareCard.repsLegend
  const width = 7 + BAR_W + 5 + ctx.measureText(label).width + 7
  const x = RIGHT - width
  const y = top + 8
  ctx.fillStyle = palette.bg
  roundRect(ctx, x, y, width, PILL_H, PILL_H / 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = palette.line
  ctx.stroke()
  const mid = y + PILL_H / 2
  ctx.fillStyle = repColor(activity, palette)
  roundRect(ctx, x + 7, mid - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2)
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.mu
  ctx.fillText(label, x + 7 + BAR_W + 5, mid)
}

function hasReps(scene: ShareCardScene): boolean {
  return (scene.activity.reps?.windows.length ?? 0) > 0
}

/**
 * Fitted between the header and the stats, so it never runs under the words.
 * An interval session draws the run in grey and its reps over it, wider, so a
 * rep run down the warm-up's road still shows.
 */
function drawRoute(ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout) {
  const { activity, palette, mapImage, mapPoints } = scene
  const route = activity.route
  if (!route || route.length < 2) return
  let pts: [number, number][]
  if (mapImage && mapPoints && mapPoints.length > 1) {
    ctx.drawImage(mapImage, 0, 0, W, H)
    pts = mapPoints
  } else {
    pts = projectRoute(route, W, H, layout.routeFrame)
  }

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.save()
  ctx.globalAlpha = 0.85
  const reps = hasReps(scene)
  strokeLine(ctx, pts, palette.casing, (reps ? GREY_W : TRACE_W) + 3)
  ctx.restore()
  if (reps) {
    strokeLine(ctx, pts, palette.trace, GREY_W)
    for (const [from, to] of activity.reps!.windows) strokeLine(ctx, slicePolyline(pts, from, to), repColor(activity, palette), REP_W)
  } else {
    strokeLine(ctx, pts, palette.route, TRACE_W)
  }

  const first = pts[0]!
  const last = pts[pts.length - 1]!
  for (const end of routeEnds(first, last, endsJoined(first, last))) drawRouteMarker(ctx, end.kind, end.at, palette.marker, MARKER_SCALE)
}

/**
 * Only between the bands, where no fade can cut one, and only a name whole
 * inside the side margins: MapLibre placed it beside its point, but the card
 * centres it on the point.
 */
function drawPlaceLabels(ctx: Ctx, { mapLabels, palette, fonts }: ShareCardScene, { textTop, textBottom }: ShareCardLayout) {
  if (!mapLabels?.length) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const label of mapLabels) {
    const half = label.size / 2
    if (label.y - half < textTop + ROUTE_TEXT_GAP || label.y + half > textBottom - ROUTE_TEXT_GAP) continue
    ctx.font = `600 ${label.size}px ${fonts.text}`
    const halfWidth = ctx.measureText(label.text).width / 2
    if (label.x - halfWidth < PAD_X || label.x + halfWidth > W - PAD_X) continue
    ctx.globalAlpha = label.opacity
    ctx.lineWidth = 3
    ctx.strokeStyle = palette.bg
    ctx.strokeText(label.text, label.x, label.y)
    ctx.fillStyle = label.color
    ctx.fillText(label.text, label.x, label.y)
  }
  ctx.restore()
}

const GLOW_GRAIN_PX = 96
let grain: HTMLCanvasElement | null = null

/** Faint noise, the same every time: a smooth dark gradient bands into steps once Instagram or Strava recompress it. */
function grainTile(): HTMLCanvasElement | null {
  if (grain || typeof document === 'undefined') return grain
  const tile = document.createElement('canvas')
  tile.width = tile.height = GLOW_GRAIN_PX
  const g = tile.getContext('2d')
  if (!g) return null
  const image = g.createImageData(GLOW_GRAIN_PX, GLOW_GRAIN_PX)
  let seed = 0x2545f491
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const v = seed >>> 24
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v
    image.data[i + 3] = 6
  }
  g.putImageData(image, 0, 0)
  return (grain = tile)
}

/** The app's glow, in the run's own colour, so the dark card reads as RunOmics; on white a tint only looks washed out. */
function drawGlow(ctx: Ctx, { activity, palette }: ShareCardScene) {
  if (palette.mode !== 'dark' || typeof ctx.createRadialGradient !== 'function') return
  const colour = repColor(activity, palette)
  const glow = ctx.createRadialGradient(W * 0.12, 0, 0, W * 0.12, 0, W * 1.05)
  glow.addColorStop(0, withAlpha(colour, 0.3))
  glow.addColorStop(0.5, withAlpha(colour, 0.09))
  glow.addColorStop(1, withAlpha(colour, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  const tile = typeof ctx.createPattern === 'function' ? grainTile() : null
  const pattern = tile ? ctx.createPattern(tile, 'repeat') : null
  if (!pattern) return
  // In device pixels: under the export's scale, one noise pixel would be four.
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** The fade spans only the gap the route keeps clear of the words, so it never dims the line. */
function drawBands(ctx: Ctx, { palette }: ShareCardScene, { textTop, textBottom }: ShareCardLayout) {
  const solid = palette.bg
  const clear = withAlpha(palette.bg, 0)
  ctx.fillStyle = solid
  ctx.fillRect(0, 0, W, textTop)
  const top = ctx.createLinearGradient(0, textTop, 0, textTop + ROUTE_TEXT_GAP)
  top.addColorStop(0, solid)
  top.addColorStop(1, clear)
  ctx.fillStyle = top
  ctx.fillRect(0, textTop, W, ROUTE_TEXT_GAP)

  const bottom = ctx.createLinearGradient(0, textBottom - ROUTE_TEXT_GAP, 0, textBottom)
  bottom.addColorStop(0, clear)
  bottom.addColorStop(1, solid)
  ctx.fillStyle = bottom
  ctx.fillRect(0, textBottom - ROUTE_TEXT_GAP, W, ROUTE_TEXT_GAP)
  ctx.fillStyle = solid
  ctx.fillRect(0, textBottom, W, H - textBottom)
}

const HEADLINE_SIZE = 64
const HEADLINE_LABEL_SIZE = 14
const HEADLINE_GAP = 8
const ZONE_BAR_H = 16
const LEGEND_ROW = 13
const LEGEND_ROW_GAP = 14
const LEGEND_COL_GAP = 16
const SWATCH = 9
/** The least room between the parts, on a middle too short to spread them. */
const ZONE_MIN_GAP = 8

export interface ZoneBlockLayout {
  headlineTop: number
  barTop: number
  legendTop: number
  legendH: number
}

/** CSS's space-evenly. */
export function zoneBlockLayout(middleH: number, rows: number): ZoneBlockLayout {
  const legendH = rows * LEGEND_ROW + Math.max(0, rows - 1) * LEGEND_ROW_GAP
  const parts = HEADLINE_SIZE + ZONE_BAR_H + legendH
  const gap = Math.max(ZONE_MIN_GAP, (middleH - parts) / 4)
  const headlineTop = (middleH - parts - 2 * gap) / 2
  const barTop = headlineTop + HEADLINE_SIZE + gap
  return { headlineTop, barTop, legendTop: barTop + ZONE_BAR_H + gap, legendH }
}

/** No gaps between the bar's segments, so each segment is its percent. */
function drawZones(ctx: Ctx, { activity, palette, fonts }: ShareCardScene, { middleH }: ShareCardLayout) {
  const s = t.activity.shareCard
  const zones = shareZones(activity)
  ctx.textAlign = 'left'
  if (!zones) {
    ctx.font = `400 12px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.textBaseline = 'middle'
    ctx.fillText(s.noZones, PAD_X, middleH / 2)
    return
  }

  const block = zoneBlockLayout(middleH, Math.ceil(zones.rows.length / 2))
  const barW = RIGHT - PAD_X

  ctx.textBaseline = 'alphabetic'
  const pct = formatPercent(zones.headline.percent)
  ctx.font = `600 ${HEADLINE_LABEL_SIZE}px ${fonts.text}`
  const labelW = ctx.measureText(zones.headline.label).width
  let size = HEADLINE_SIZE
  const headlineFont = () => {
    ctx.font = `700 ${size}px ${fonts.display}`
    setSpacing(ctx, -0.04 * size)
  }
  headlineFont()
  while (size > 40 && ctx.measureText(pct).width + HEADLINE_GAP + labelW > barW) {
    size -= 4
    headlineFont()
  }
  ctx.fillStyle = palette.tx
  const baseline = block.headlineTop + Math.round(HEADLINE_SIZE * 0.8)
  ctx.fillText(pct, PAD_X, baseline)
  const pctW = ctx.measureText(pct).width
  setSpacing(ctx, 0)
  ctx.font = `600 ${HEADLINE_LABEL_SIZE}px ${fonts.text}`
  ctx.fillText(zones.headline.label, PAD_X + pctW + HEADLINE_GAP, baseline)

  const barTop = block.barTop
  ctx.save()
  roundRect(ctx, PAD_X, barTop, barW, ZONE_BAR_H, ZONE_BAR_H / 2)
  ctx.clip()
  let at = PAD_X
  for (const row of zones.rows) {
    const w = (row.percent / 100) * barW
    ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
    ctx.fillRect(at, barTop, w, ZONE_BAR_H)
    at += w
  }
  ctx.restore()

  const colW = (barW - LEGEND_COL_GAP) / 2
  zones.rows.forEach((row, i) => {
    const x = PAD_X + (i % 2) * (colW + LEGEND_COL_GAP)
    const mid = block.legendTop + Math.floor(i / 2) * (LEGEND_ROW + LEGEND_ROW_GAP) + LEGEND_ROW / 2
    ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
    ctx.beginPath()
    ctx.arc(x + SWATCH / 2, mid, SWATCH / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = `400 11px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.fillText(`${zoneName(row)} ${t.zoneLabels[row.zone] ?? ''}`.trim(), x + SWATCH + 7, mid)
    ctx.textAlign = 'right'
    ctx.font = `700 11px ${fonts.text}`
    ctx.fillStyle = palette.tx
    ctx.fillText(formatPercent(row.percent), x + colW, mid)
  })
}

function greedyLines(ctx: Ctx, words: string[], max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(next).width <= max) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** As text-wrap: balance: the narrowest width that still takes no more lines than `max` does. */
export function balanceWrap(ctx: Ctx, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = greedyLines(ctx, words, max)
  if (lines.length < 2) return lines
  let [lo, hi] = [0, max]
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    if (greedyLines(ctx, words, mid).length <= lines.length) hi = mid
    else lo = mid
  }
  return greedyLines(ctx, words, hi)
}

const VERDICT_SIZES = [27, 24, 22, 20] as const
const VERDICT_MAX_LINES = 3
const VERDICT_EYEBROW = 9.5
const VERDICT_EYEBROW_GAP = 10
const VERDICT_BAR_GAP = 16
const VERDICT_BAR_H = 6
const VERDICT_SEGMENT_GAP = 2
const VERDICT_LABEL = 9
const VERDICT_LABEL_GAP = 6

export interface VerdictHero {
  lines: string[]
  size: number
  lineHeight: number
}

export function verdictHero(ctx: Ctx, headline: string, fonts: ShareFonts): VerdictHero {
  const max = RIGHT - PAD_X
  const font = (size: number) => {
    ctx.font = `700 ${size}px ${fonts.display}`
    setSpacing(ctx, -0.02 * size)
  }
  let size: number = VERDICT_SIZES[0]
  let lines: string[] = []
  for (size of VERDICT_SIZES) {
    font(size)
    lines = balanceWrap(ctx, headline, max)
    if (lines.length <= VERDICT_MAX_LINES) break
  }
  if (lines.length > VERDICT_MAX_LINES) {
    lines = [...lines.slice(0, VERDICT_MAX_LINES - 1), fit(ctx, lines.slice(VERDICT_MAX_LINES - 1).join(' '), max)]
  }
  lines = lines.map((line) => fit(ctx, line, max))
  setSpacing(ctx, 0)
  return { lines, size, lineHeight: Math.round(size * 1.08) }
}

export interface ZoneBarLabel {
  zone: number
  text: string
  x: number
  align: 'left' | 'center' | 'right'
}

/** Where two would touch, the bigger share keeps its label. */
export function zoneBarLabels(rows: readonly ShareZoneRow[], left: number, width: number, measure: (text: string) => number): ZoneBarLabel[] {
  const GAP = 8
  let at = left
  const all = rows.map((row, i) => {
    const w = (row.percent / 100) * width
    const text = `${zoneName(row)} ${formatPercent(row.percent)}`
    const textW = measure(text)
    const align: ZoneBarLabel['align'] = i === 0 ? 'left' : i === rows.length - 1 ? 'right' : 'center'
    const x = align === 'left' ? at : align === 'right' ? at + w : at + w / 2
    const from = Math.min(Math.max(align === 'left' ? x : align === 'right' ? x - textW : x - textW / 2, left), left + width - textW)
    at += w
    return { label: { zone: row.zone, text, x, align }, from, to: from + textW, percent: row.percent }
  })
  const kept: typeof all = []
  for (const c of [...all].sort((a, b) => b.percent - a.percent)) {
    if (kept.every((k) => c.to + GAP <= k.from || c.from >= k.to + GAP)) kept.push(c)
  }
  return all.filter((c) => kept.includes(c)).map((c) => c.label)
}

function drawVerdict(ctx: Ctx, scene: ShareCardScene, verdict: ShareVerdict, { middleH }: ShareCardLayout) {
  const { activity, palette, fonts } = scene
  const hero = verdictHero(ctx, verdict.headline, fonts)
  const zones = shareZones(activity)
  const barBlock = zones ? VERDICT_BAR_GAP + VERDICT_BAR_H + VERDICT_LABEL_GAP + VERDICT_LABEL : 0
  const heroH = hero.lines.length * hero.lineHeight
  const blockH = VERDICT_EYEBROW + VERDICT_EYEBROW_GAP + heroH + barBlock
  let y = Math.max(0, (middleH - blockH) / 2)

  const tone = verdict.tone === 'positive' ? palette.pos : verdict.tone === 'caution' ? palette.warn : palette.mu
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = tone
  ctx.beginPath()
  ctx.arc(PAD_X + 2.5, y + VERDICT_EYEBROW / 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = `700 ${VERDICT_EYEBROW}px ${fonts.text}`
  setSpacing(ctx, 0.1 * VERDICT_EYEBROW)
  ctx.fillText(t.activity.verdict.eyebrow[verdict.tone].toLocaleUpperCase(t.locale), PAD_X + 10, y + VERDICT_EYEBROW / 2)
  setSpacing(ctx, 0)
  y += VERDICT_EYEBROW + VERDICT_EYEBROW_GAP

  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${hero.size}px ${fonts.display}`
  ctx.fillStyle = palette.tx
  setSpacing(ctx, -0.02 * hero.size)
  // The first baseline a cap height and a little under the line's top.
  hero.lines.forEach((line, i) => ctx.fillText(line, PAD_X, y + i * hero.lineHeight + Math.round(hero.size * 0.86)))
  setSpacing(ctx, 0)
  y += heroH
  if (!zones) return

  y += VERDICT_BAR_GAP
  const barW = RIGHT - PAD_X
  let at = PAD_X
  for (const row of zones.rows) {
    const w = (row.percent / 100) * barW
    const last = row === zones.rows[zones.rows.length - 1]
    ctx.fillStyle = palette.zones[row.zone - 1] ?? palette.mu
    roundRect(ctx, at, y, Math.max(w - (last ? 0 : VERDICT_SEGMENT_GAP), 1), VERDICT_BAR_H, VERDICT_BAR_H / 2)
    ctx.fill()
    at += w
  }
  y += VERDICT_BAR_H + VERDICT_LABEL_GAP

  ctx.font = `500 ${VERDICT_LABEL}px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.textBaseline = 'top'
  for (const label of zoneBarLabels(zones.rows, PAD_X, barW, (text) => ctx.measureText(text).width)) {
    ctx.textAlign = label.align
    ctx.fillText(label.text, label.x, y)
  }
  ctx.textAlign = 'left'
}

function drawStatsMiddle(ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout) {
  const verdict = scene.activity.verdict
  if (verdict) drawVerdict(ctx, scene, verdict, layout)
  else drawZones(ctx, scene, layout)
}

/** The app's 24 px line icon, scaled to `size`. */
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

/** The sheet covers it with its own picker. */
function drawPhotoEmpty(ctx: Ctx, { palette, fonts }: ShareCardScene, { middleH }: ShareCardLayout) {
  const s = t.activity.shareCard
  ctx.fillStyle = palette.fa
  ctx.fillRect(0, 0, W, middleH)
  camera(ctx, W / 2, middleH / 2 - 26, 34, palette.tx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 15px ${fonts.text}`
  ctx.fillStyle = palette.tx
  ctx.fillText(s.choosePhoto, W / 2, middleH / 2 + 8)
  ctx.font = `400 11px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.fillText(s.photoHint, W / 2, middleH / 2 + 27)
}

/** The foot of the date and place line. */
export function headerFoot({ title }: Pick<ShareCardLayout, 'title'>): number {
  return TITLE_BASELINE + (title.lines.length - 1) * title.lineHeight + 18 + 3
}

/**
 * [offset, black's alpha] stops. It holds .62 to the foot of the header's
 * words, 5:1 there on white: clearing sooner left the date line 2.5:1 on a white sky.
 */
export function photoScrim(headerBottom: number): [number, number][] {
  const words = headerBottom / H
  return [[0, 0.72], [words, 0.62], [Math.min(0.52, Math.max(0.38, words + 0.14)), 0], [0.52, 0], [1, 0.78]]
}

function drawPhoto(ctx: Ctx, photo: HTMLImageElement, layout: ShareCardLayout) {
  drawCover(ctx, photo, W, H)
  const scrim = ctx.createLinearGradient(0, 0, 0, H)
  for (const [offset, alpha] of photoScrim(headerFoot(layout))) scrim.addColorStop(offset, `rgba(0, 0, 0, ${alpha})`)
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, W, H)
}

function drawStats(ctx: Ctx, { activity, fonts }: ShareCardScene, top: number, ink: Ink) {
  const stats = shareStats(activity)
  const valueFont = `700 15px ${fonts.display}`
  const unitFont = `500 9px ${fonts.text}`
  const labelFont = `400 9.5px ${fonts.text}`
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
    ctx.fillText(stat.value, x, top + 13)
    if (stat.unit) {
      ctx.font = unitFont
      ctx.fillStyle = ink.mu
      ctx.fillText(stat.unit, x + valueW, top + 13)
    }
    ctx.textBaseline = 'top'
    ctx.font = labelFont
    ctx.fillStyle = ink.mu
    ctx.fillText(stat.label, x, top + 19)
    x += width + gap
  }
}

const MIDDLES: Record<Exclude<ShareDesign, 'route'>, (ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout) => void> = {
  stats: drawStatsMiddle,
  photo: drawPhotoEmpty,
}

export function drawShareCard(ctx: Ctx, scene: ShareCardScene) {
  const layout = shareCardLayout(ctx, scene.activity, scene.fonts, scene.design)
  const { palette } = scene
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)

  const photo = scene.design === 'photo' ? scene.photo : null
  if (photo) {
    drawPhoto(ctx, photo, layout)
  } else if (scene.design === 'route') {
    drawRoute(ctx, scene, layout)
    drawPlaceLabels(ctx, scene, layout)
    drawBands(ctx, scene, layout)
    // Over the bands, so the stats' fade does not cover it.
    if (hasReps(scene)) drawRepsLegend(ctx, scene, layout.textTop)
  } else {
    if (scene.design === 'stats') drawGlow(ctx, scene)
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
    ctx.fillStyle = palette.card
    ctx.fillRect(0, layout.ruleY, W, H - layout.ruleY)
    ctx.fillStyle = palette.line
    ctx.fillRect(0, layout.ruleY, W, 1)
  }
  drawHeader(ctx, scene, layout, ink)
  if (layout.hero) drawHero(ctx, scene, layout.hero, layout.heroTop, ink)
  if (layout.repDetail) drawRepDetail(ctx, scene, layout.repDetail, layout.repDetailTop, ink)
  drawStats(ctx, scene, layout.statsTop, ink)
}
