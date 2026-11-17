import {
  shareCardSubtitle, shareCardTitle, shareDuration, shareRepDetail, shareRepHeadline, shareRepHero, shareRepResult, shareStats,
  shareZones, zoneName, zoneTint,
  type ShareActivity, type ShareRepDetail, type ShareRepHeadline, type ShareRepHero, type ShareZoneRow, type ShareZones,
} from '@/lib/shareCardStats'
import { W, H, shareCardHeight, type ShareDesign, type SharePalette, type ShareSize } from '@/lib/shareCardPalette'
import { projectRoute, routeFencePoints, ROUTE_INSET, ROUTE_TEXT_GAP, type RouteFrame } from '@/lib/shareCardMap'
import { runTypeZone } from '@/lib/colors'
import { drawRouteMarker, drawStartDot, endsJoined, MARKER_CLEARANCE, MARKER_SCALE, MARKER_SPECS } from '@/lib/routeMarkers'
import { drawMark } from '@/lib/brandMark'
import { t } from '@/i18n'
import { formatKm, formatPercent } from '@/lib/formatters'
import { repPhase, STILL_MOTION, videoMotion, type VideoMotion } from '@/lib/shareCardTimeline'

function repColor(activity: ShareActivity, palette: SharePalette): string {
  return palette.zones[runTypeZone(activity.type) - 1] ?? palette.zones[3]!
}

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
  /** 4:5 by default. */
  size?: ShareSize
  place?: string | null
  photo?: HTMLImageElement | null
  /** Drawn for the layout's route frame; mapPoints is the route projected onto it. */
  mapImage?: HTMLCanvasElement | null
  mapPoints?: [number, number][] | null
  /** As MapLibre placed them, drawn over the route. */
  mapLabels?: ShareMapLabel[] | null
  /** 0..1 share of the route drawn, for the video; undefined is the still card. */
  progress?: number
  /** Seconds into the video, for the marker pops and fades. */
  clipTime?: number
  /** A looping preview: the route fades out at the clip's end. */
  loop?: boolean
}

/** In the card's px. */
export interface ShareMapLabel {
  text: string
  x: number
  y: number
  size: number
  color: string
  opacity: number
  /** Lower survives a collision: the start area, the finish's, a famous place, the park, the water, then every other area. */
  priority?: number
  /** How the card places it; an area by default. */
  kind?: LabelKind
}

/** start, finish: nudged, never dropped; famous, landmark: off the route if they can; water: off it or dropped; area: at its point. */
export type LabelKind = 'start' | 'finish' | 'famous' | 'landmark' | 'water' | 'area'

export const LABEL_PRIORITY = { start: 1, finish: 2, famous: 3, landmark: 4, water: 5, area: 6 } as const

/** A famous place's mark at the place itself, its name beside it, as the Activity map draws one. */
const FAMOUS_MARK_R = 3
const FAMOUS_MARK_GAP = 3

/** Set `runomics:debug-labels` in localStorage to log why each name was dropped. */
export function labelDebug(...args: unknown[]): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('runomics:debug-labels')) console.debug('[share labels]', ...args)
  } catch {
    // Storage blocked: no debug.
  }
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
/** Under the title's size, so the workout stays the headline; the header grows by its height. */
const RESULT_SIZES = [16, 15, 14] as const
const RESULT_GAP = 22
const RESULT_H = 24
const STATS_BLOCK = 32
const STATS_PAD_TOP = 12
const STATS_PAD_BOTTOM = 16
const HERO_PAD_TOP = 12
const HERO_BLOCK = 42
const HERO_PACE_SIZE = 32
const CHIP_H = 22
const CHIP_GAP = 6
const CHIP_TEXT = 10
const BAR_MAX = 16
const REP_DETAIL_PAD_TOP = 8
const REP_DETAIL_H = { chips: CHIP_H, bars: BAR_MAX + 12 } as const
const STATS_PAD_TOP_AFTER_HERO = 16
/** The video's head dot is a step under the start's 13.6 px. */
const HEAD_SCALE = 11 / 16

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
  height: number
  title: ShareTitle
  /** The reps' result under the header, on the Route and Stats cards. */
  result: string | null
  hero: ShareRepHero | null
  /** The Stats card's rep pace, in the middle where a plain run has its zones. */
  repHeadline: ShareRepHeadline | null
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

/** The Route card carries the rep pace in its stat row, so the map keeps its full height. */
export function shareCardLayout(
  ctx: Ctx, activity: ShareActivity, fonts: ShareFonts, design: ShareDesign = 'route', size: ShareSize = 'portrait',
): ShareCardLayout {
  const height = shareCardHeight(size)
  const title = titleLines(ctx, shareCardTitle(activity), fonts)
  const result = design === 'photo' ? null : shareRepResult(activity)
  const middleTop = HEADER_BASE + (title.lines.length - 1) * title.lineHeight + (result ? RESULT_H : 0)
  const repHeadline = design === 'stats' ? shareRepHeadline(activity) : null
  const hero = design === 'route' || repHeadline ? null : shareRepHero(activity)
  const repDetail = hero ? shareRepDetail(activity) : null
  const detailH = repDetail ? REP_DETAIL_PAD_TOP + REP_DETAIL_H[repDetail.kind] : 0
  const statsTop = height - STATS_PAD_BOTTOM - STATS_BLOCK
  const stripTop = statsTop - (hero ? STATS_PAD_TOP_AFTER_HERO : STATS_PAD_TOP)
  const footerTop = stripTop - (hero ? HERO_PAD_TOP + HERO_BLOCK + detailH : 0)
  const textTop = headerFoot({ title, result })
  return {
    height,
    title,
    result,
    hero,
    repHeadline,
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
    routeFrame: { top: textTop + ROUTE_TEXT_GAP, right: ROUTE_INSET, bottom: height - footerTop + ROUTE_TEXT_GAP, left: ROUTE_INSET },
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

const SUBTITLE_ALPHA = 0.82

const PHOTO_INK: Ink = { tx: '#ffffff', mu: 'rgba(255, 255, 255, 0.85)', mark: '#ffffff' }

function drawHeader(ctx: Ctx, { activity, fonts, place }: ShareCardScene, { title, result }: ShareCardLayout, ink: Ink) {
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
  ctx.font = `400 10px ${fonts.text}`
  // A step above the muted ink: the only place the date shows.
  ctx.save()
  ctx.fillStyle = ink.tx
  ctx.globalAlpha *= SUBTITLE_ALPHA
  ctx.fillText(fit(ctx, shareCardSubtitle(activity, place), RIGHT - PAD_X), PAD_X, last + 18)
  ctx.restore()
  if (!result) return

  const max = RIGHT - PAD_X
  let size: number = RESULT_SIZES[0]
  for (size of RESULT_SIZES) {
    ctx.font = `600 ${size}px ${fonts.display}`
    setSpacing(ctx, -0.02 * size)
    if (ctx.measureText(result).width <= max) break
  }
  // A posted card says the result plainly: green would grade the run on the athlete's behalf.
  ctx.fillStyle = ink.tx
  ctx.fillText(fit(ctx, result, max), PAD_X, last + 18 + RESULT_GAP)
  setSpacing(ctx, 0)
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
    // One row the card's width, so the reps read at the size of the stats under them.
    const count = detail.chips.length
    const width = (RIGHT - PAD_X - CHIP_GAP * (count - 1)) / count
    detail.chips.forEach((chip, i) => {
      const x = PAD_X + i * (width + CHIP_GAP)
      ctx.font = `400 ${CHIP_TEXT}px ${fonts.text}`
      const labelW = ctx.measureText(`${chip.label} `).width
      ctx.font = `600 ${CHIP_TEXT}px ${fonts.text}`
      const from = x + (width - labelW - ctx.measureText(chip.pace).width) / 2
      ctx.fillStyle = palette.card
      roundRect(ctx, x, top, width, CHIP_H, 7)
      ctx.fill()
      ctx.font = `400 ${CHIP_TEXT}px ${fonts.text}`
      ctx.fillStyle = ink.mu
      ctx.fillText(chip.label, from, top + CHIP_H / 2)
      ctx.font = `600 ${CHIP_TEXT}px ${fonts.text}`
      ctx.fillStyle = ink.tx
      ctx.fillText(chip.pace, from + labelW, top + CHIP_H / 2)
    })
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

interface ChipPart {
  text: string
  color: string
  weight: 400 | 600
}

function legendParts(scene: ShareCardScene, palette: SharePalette): { parts: ChipPart[]; bar: string } {
  const { activity, progress } = scene
  const s = t.activity.shareCard
  const rep = repColor(activity, palette)
  const muted = (text: string): ChipPart => ({ text, color: palette.mu, weight: 400 })
  if (progress !== undefined && progress < 1) {
    const phase = repPhase(activity.reps!.windows, progress)
    switch (phase.kind) {
      case 'rep':
        return { parts: [{ text: s.repOf(phase.n, phase.count), color: palette.tx, weight: 600 }], bar: rep }
      case 'recovery':
        return { parts: [muted(s.recovery)], bar: palette.trace }
      case 'warmUp':
        return { parts: [muted(s.warmUp)], bar: palette.trace }
      default:
        return { parts: [muted(s.coolDown)], bar: palette.trace }
    }
  }
  return { parts: [muted(s.repsLegend)], bar: rep }
}

function drawRepsLegend(ctx: Ctx, scene: ShareCardScene, top: number) {
  const { palette, fonts } = scene
  const BAR_W = 14
  const BAR_H = 3
  const PILL_H = 18
  const { parts, bar } = legendParts(scene, palette)
  const widths = parts.map((part) => {
    ctx.font = `${part.weight} 9px ${fonts.text}`
    return ctx.measureText(part.text).width
  })
  const width = 7 + BAR_W + 5 + widths.reduce((a, b) => a + b, 0) + 7
  const x = RIGHT - width
  const y = top + 8
  ctx.save()
  ctx.fillStyle = palette.bg
  roundRect(ctx, x, y, width, PILL_H, PILL_H / 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = palette.line
  ctx.stroke()
  const mid = y + PILL_H / 2
  ctx.fillStyle = bar
  roundRect(ctx, x + 7, mid - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2)
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let at = x + 7 + BAR_W + 5
  parts.forEach((part, i) => {
    ctx.font = `${part.weight} 9px ${fonts.text}`
    ctx.fillStyle = part.color
    ctx.fillText(part.text, at, mid)
    at += widths[i]!
  })
  ctx.restore()
}

function hasReps(scene: ShareCardScene): boolean {
  return (scene.activity.reps?.windows.length ?? 0) > 0
}

function routePoints(scene: ShareCardScene, layout: ShareCardLayout): [number, number][] | null {
  const route = scene.activity.route
  if (!route || route.length < 2) return null
  if (scene.mapImage && scene.mapPoints && scene.mapPoints.length > 1) return scene.mapPoints
  return projectRoute(route, W, layout.height, layout.routeFrame)
}

function sceneMotion(scene: ShareCardScene): VideoMotion {
  return scene.clipTime === undefined ? STILL_MOTION : videoMotion(scene.clipTime, scene.loop)
}

/**
 * Fitted between the header and the stats, so it never runs under the words.
 * An interval session draws the run in grey and its reps over it, wider, so a
 * rep run down the warm-up's road still shows.
 */
function drawRoute(ctx: Ctx, scene: ShareCardScene, pts: [number, number][], motion: VideoMotion, height: number) {
  const { activity, palette, mapImage, mapPoints } = scene
  if (mapImage && mapPoints && mapPoints.length > 1) ctx.drawImage(mapImage, 0, 0, W, height)
  const progress = scene.progress ?? 1
  if (progress <= 0) return
  const drawn = progress >= 1 ? pts : slicePolyline(pts, 0, progress)

  ctx.save()
  ctx.globalAlpha *= motion.route
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.save()
  ctx.globalAlpha *= 0.85
  const reps = hasReps(scene)
  strokeLine(ctx, drawn, palette.casing, (reps ? GREY_W : TRACE_W) + 3)
  ctx.restore()
  if (reps) {
    strokeLine(ctx, drawn, palette.trace, GREY_W)
    for (const [from, to] of activity.reps!.windows) {
      if (from < progress) strokeLine(ctx, slicePolyline(pts, from, Math.min(to, progress)), repColor(activity, palette), REP_W)
    }
  } else {
    strokeLine(ctx, drawn, palette.route, TRACE_W)
  }
  ctx.restore()
}

/** Over the place names, so no name covers the start. */
function drawMarkers(ctx: Ctx, scene: ShareCardScene, pts: [number, number][], motion: VideoMotion) {
  const { activity, palette } = scene
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const progress = scene.progress ?? 1
  const ink = { fill: palette.marker, ring: palette.markerRing, outline: palette.markerOutline }
  if (progress >= 1 && !endsJoined(first, last) && motion.finishPop > 0) {
    drawRouteMarker(ctx, 'finish', last, palette.marker, MARKER_SCALE * motion.finishPop)
  }
  if (motion.startPop > 0) drawStartDot(ctx, first, ink, MARKER_SCALE * motion.startPop)
  if (progress > 0 && progress < 1) {
    const head = slicePolyline(pts, 0, progress).at(-1) ?? first
    const inRep = hasReps(scene) && repPhase(activity.reps!.windows, progress).kind === 'rep'
    drawStartDot(ctx, head, { ...ink, fill: inRep ? repColor(activity, palette) : palette.marker }, HEAD_SCALE)
  }
}

/** Two lines at most, balanced, for a park's long name: "Forêt de la / Clairière". */
const BESIDE_MAX_W = 96
/** Px a name beside the route keeps off the line: the trace and its casing. */
const ROUTE_CLEAR = 4
const BESIDE_RADII = [0, 14, 24, 36, 50] as const
/** Up, down, then sideways, then the diagonals: a nudge off a marker keeps the name above or below it first. */
const ANGLES = [-90, 90, 180, 0, -135, -45, 135, 45].map((deg) => (deg * Math.PI) / 180)
const NUDGE_RADII = [0, 12, 18, 26, 36, 50, 66] as const

interface Placed {
  label: ShareMapLabel
  lines: string[]
  x: number
  y: number
  box: [number, number, number, number]
  /** A famous place's mark, at the place itself. */
  mark?: [number, number, number, number]
}

function overlaps(a: Placed['box'], b: Placed['box']): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
}

/** A marker as a name must keep clear of it: centre and radius, in the card's px. */
export interface MarkerObstacle {
  x: number
  y: number
  r: number
}


/** As drawn on the card, outline included. */
export function shareMarkerRadius(kind: 'start' | 'finish', palette: Pick<SharePalette, 'markerOutline'>): number {
  const spec = MARKER_SPECS[kind]
  const outline = kind === 'start' ? (palette.markerOutline ? 1 : 0) : spec.outline
  return (spec.diameter / 2 + outline) * MARKER_SCALE
}

export function markerObstacles(pts: readonly [number, number][], palette: Pick<SharePalette, 'markerOutline'>): MarkerObstacle[] {
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const at = (p: [number, number], kind: 'start' | 'finish') => ({ x: p[0], y: p[1], r: shareMarkerRadius(kind, palette) + MARKER_CLEARANCE })
  return endsJoined(first, last) ? [at(first, 'start')] : [at(first, 'start'), at(last, 'finish')]
}

function touches(box: Placed['box'], { x, y, r }: MarkerObstacle): boolean {
  const dx = x - Math.max(box[0], Math.min(x, box[2]))
  const dy = y - Math.max(box[1], Math.min(y, box[3]))
  return dx * dx + dy * dy < r * r
}

export type DropReason = 'band' | 'margin' | 'collision' | 'marker' | 'route'

function spotsAt(radii: readonly number[]): [number, number][] {
  return radii.flatMap((r) => (r === 0 ? [[0, 0] as [number, number]] : ANGLES.map((a): [number, number] => [Math.cos(a) * r, Math.sin(a) * r])))
}

interface Fit {
  lines: string[]
  halfW: number
  halfH: number
}

/** Highest priority first; a name gives way to a higher one, a band, a margin or a marker, as its kind allows. */
export function arrangeLabels(
  ctx: Ctx, labels: readonly ShareMapLabel[], route: readonly [number, number][] | null, { textTop, textBottom }: Pick<ShareCardLayout, 'textTop' | 'textBottom'>,
  fonts: ShareFonts, obstacles: readonly MarkerObstacle[] = [], onDrop?: (label: ShareMapLabel, reason: DropReason) => void,
): Placed[] {
  const fence = route ? routeFencePoints(route, 3) : []
  const top = textTop + ROUTE_TEXT_GAP
  const bottom = textBottom - ROUTE_TEXT_GAP
  const placed: Placed[] = []
  const fits = new Map<ShareMapLabel, Fit>()
  const fitOf = (label: ShareMapLabel): Fit => {
    const known = fits.get(label)
    if (known) return known
    ctx.font = `600 ${label.size}px ${fonts.text}`
    const wraps = label.kind && label.kind !== 'area'
    const lines = wraps ? (balanceLines(ctx, label.text, BESIDE_MAX_W) ?? [label.text]) : [label.text]
    const fit = { lines, halfW: Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2, halfH: (label.size * lines.length + (lines.length - 1) * 2) / 2 }
    fits.set(label, fit)
    return fit
  }
  const onRoute = (box: Placed['box']) => fence.some(([px, py]) => px > box[0] - ROUTE_CLEAR && px < box[2] + ROUTE_CLEAR && py > box[1] - ROUTE_CLEAR && py < box[3] + ROUTE_CLEAR)
  const why = (box: Placed['box'], avoidRoute: boolean): DropReason | null => {
    if (box[1] < top || box[3] > bottom) return 'band'
    if (box[0] < PAD_X || box[2] > W - PAD_X) return 'margin'
    if (obstacles.some((o) => touches(box, o))) return 'marker'
    if (placed.some((p) => overlaps(p.box, box) || (p.mark && overlaps(p.mark, box)))) return 'collision'
    if (avoidRoute && onRoute(box)) return 'route'
    return null
  }
  const tryPlace = (label: ShareMapLabel, spots: readonly [number, number][], avoidRoute: boolean, mark?: Placed['mark']): DropReason | null => {
    const { lines, halfW, halfH } = fitOf(label)
    const markReason = mark ? why(mark, false) : null
    if (markReason) return markReason
    let first: DropReason | null = null
    for (const [dx, dy] of spots) {
      const x = label.x + dx
      const y = label.y + dy
      const box: Placed['box'] = [x - halfW, y - halfH, x + halfW, y + halfH]
      const reason = why(box, avoidRoute)
      if (!reason) {
        placed.push({ label, lines, x, y, box, ...(mark ? { mark } : {}) })
        return null
      }
      first ??= reason
    }
    return first ?? 'collision'
  }
  /** Inside the margins and bands, off the markers, whatever it overlaps: a name that must show. */
  const force = (label: ShareMapLabel) => {
    const { lines, halfW, halfH } = fitOf(label)
    for (const [dx, dy] of spotsAt(NUDGE_RADII)) {
      const x = Math.min(Math.max(label.x + dx, PAD_X + halfW), W - PAD_X - halfW)
      const y = Math.min(Math.max(label.y + dy, top + halfH), bottom - halfH)
      const box: Placed['box'] = [x - halfW, y - halfH, x + halfW, y + halfH]
      if (obstacles.some((o) => touches(box, o))) continue
      placed.push({ label, lines, x, y, box })
      return true
    }
    return false
  }
  const order = labels.map((label, i) => ({ label, i })).sort((a, b) => (a.label.priority ?? LABEL_PRIORITY.area) - (b.label.priority ?? LABEL_PRIORITY.area) || a.i - b.i)
  const dropped: ShareMapLabel[] = []
  for (const { label } of order) {
    const kind = label.kind ?? 'area'
    let reason: DropReason | null
    if (kind === 'start' || kind === 'finish') {
      reason = tryPlace(label, spotsAt(NUDGE_RADII), false)
      if (reason && force(label)) reason = null
    } else if (kind === 'famous') {
      // A moved mark would put the place somewhere it is not: only its name may move.
      const { halfW, halfH } = fitOf(label)
      const off = FAMOUS_MARK_R + FAMOUS_MARK_GAP
      const beside: [number, number][] = [[0, off + halfH], [0, -off - halfH], [off + halfW, 0], [-off - halfW, 0]]
      const mark: Placed['mark'] = [label.x - FAMOUS_MARK_R, label.y - FAMOUS_MARK_R, label.x + FAMOUS_MARK_R, label.y + FAMOUS_MARK_R]
      reason = tryPlace(label, beside, true, mark)
      if (reason) reason = tryPlace(label, beside, false, mark)
    } else if (kind === 'landmark') {
      reason = tryPlace(label, spotsAt(BESIDE_RADII), true)
      if (reason) reason = tryPlace(label, spotsAt(BESIDE_RADII), false)
    } else if (kind === 'water') {
      reason = tryPlace(label, spotsAt(BESIDE_RADII), true)
    } else {
      const { halfW } = fitOf(label)
      const inside = Math.min(Math.max(label.x, PAD_X + halfW), W - PAD_X - halfW) - label.x
      reason = tryPlace(label, inside === 0 ? [[0, 0]] : [[0, 0], [inside, 0]], false)
    }
    if (reason) {
      dropped.push(label)
      onDrop?.(label, reason)
    }
  }
  // A card always names two places: the start, and the best of what is left, nudged where it fits.
  if (placed.length < 2) {
    for (const label of dropped) {
      if (label.kind === 'famous') continue
      if (!tryPlace(label, spotsAt(NUDGE_RADII), false)) break
    }
    if (placed.length < 2 && labels.length > 0) console.warn(`Share card: ${placed.length} place name(s) on the map, two wanted`)
  }
  return placed
}

/** Only between the bands, where no fade can cut one, only a name whole inside the side margins, and none under a marker. */
function drawPlaceLabels(ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout, obstacles: MarkerObstacle[] | null, route: [number, number][] | null) {
  const { mapLabels, palette, fonts } = scene
  if (!mapLabels?.length) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const base = ctx.globalAlpha
  const still = scene.progress === undefined
  const placed = arrangeLabels(ctx, mapLabels, route, layout, fonts, obstacles ?? [], still ? (label, reason) => labelDebug(`dropped "${label.text}" (${label.kind ?? 'area'}): ${reason}`) : undefined)
  if (still) labelDebug('placed', placed.map((p) => `${p.label.text} (${p.label.kind ?? 'area'})`))
  for (const { label, lines, x, y, mark } of placed) {
    ctx.font = `600 ${label.size}px ${fonts.text}`
    ctx.globalAlpha = base * label.opacity
    ctx.lineWidth = 3
    if (mark) {
      ctx.beginPath()
      ctx.arc((mark[0] + mark[2]) / 2, (mark[1] + mark[3]) / 2, FAMOUS_MARK_R, 0, Math.PI * 2)
      ctx.strokeStyle = palette.bg
      ctx.stroke()
      ctx.fillStyle = label.color
      ctx.fill()
    }
    lines.forEach((line, i) => {
      const ly = y + (i - (lines.length - 1) / 2) * (label.size + 2)
      ctx.strokeStyle = palette.bg
      ctx.strokeText(line, x, ly)
      ctx.fillStyle = label.color
      ctx.fillText(line, x, ly)
    })
  }
  ctx.restore()
}

/** The intro's zoom, around the start: the map layer only, never the bands or the words over it. */
function drawMapLayer(ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout, motion: VideoMotion) {
  const pts = routePoints(scene, layout)
  ctx.save()
  if (motion.intro < 1) {
    const [x, y] = pts?.[0] ?? [W / 2, layout.height / 2]
    const zoom = 1.06 - 0.06 * motion.intro
    ctx.translate(x, y)
    ctx.scale(zoom, zoom)
    ctx.translate(-x, -y)
  }
  if (pts) drawRoute(ctx, scene, pts, motion, layout.height)
  drawPlaceLabels(ctx, scene, layout, pts && markerObstacles(pts, scene.palette), pts)
  if (pts) drawMarkers(ctx, scene, pts, motion)
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
function drawGlow(ctx: Ctx, { activity, palette }: ShareCardScene, height: number) {
  if (palette.mode !== 'dark' || typeof ctx.createRadialGradient !== 'function') return
  const colour = repColor(activity, palette)
  const glow = ctx.createRadialGradient(W * 0.12, 0, 0, W * 0.12, 0, W * 1.05)
  glow.addColorStop(0, withAlpha(colour, 0.3))
  glow.addColorStop(0.5, withAlpha(colour, 0.09))
  glow.addColorStop(1, withAlpha(colour, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, height)
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
function drawBands(ctx: Ctx, { palette }: ShareCardScene, { textTop, textBottom, height }: ShareCardLayout) {
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
  ctx.fillRect(0, textBottom, W, height - textBottom)
}

const HEADLINE_SIZE = 64
const HEADLINE_LABEL_SIZE = 14
const HEADLINE_GAP = 8
const ZONE_BAR_H = 16
const LEGEND_ROW = 13
const LEGEND_ROW_GAP = 14
const LEGEND_COL_GAP = 16
const LEGEND_TEXT = 11
const SWATCH = 9
const SWATCH_GAP = 7
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

  const block = zoneBlockLayout(middleH, 1)
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
    ctx.fillStyle = palette.hrZones[zoneTint(row) - 1] ?? palette.mu
    ctx.fillRect(at, barTop, w, ZONE_BAR_H)
    at += w
  }
  ctx.restore()

  const mid = block.legendTop + LEGEND_ROW / 2
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  for (const entry of legendEntries(ctx, zones.rows, fonts, barW)) {
    ctx.fillStyle = palette.hrZones[zoneTint(entry.row) - 1] ?? palette.mu
    ctx.beginPath()
    ctx.arc(entry.x + SWATCH / 2, mid, SWATCH / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `400 ${entry.size}px ${fonts.text}`
    ctx.fillStyle = palette.mu
    ctx.fillText(entry.label, entry.x + SWATCH + SWATCH_GAP, mid)
    ctx.font = `700 ${entry.size}px ${fonts.text}`
    ctx.fillStyle = palette.tx
    ctx.fillText(entry.percent, entry.x + SWATCH + SWATCH_GAP + entry.labelW, mid)
  }
}

interface LegendEntry {
  row: ShareZoneRow
  x: number
  label: string
  labelW: number
  percent: string
  size: number
}

/** One row: the zones' names go first when it is too narrow, then the size steps down. */
export function legendEntries(ctx: Ctx, rows: readonly ShareZoneRow[], fonts: ShareFonts, width: number): LegendEntry[] {
  const layouts = [
    { named: true, size: LEGEND_TEXT },
    { named: false, size: LEGEND_TEXT },
    { named: false, size: LEGEND_TEXT - 1.5 },
  ]
  let entries: LegendEntry[] = []
  for (const { named, size } of layouts) {
    let x = PAD_X
    entries = rows.map((row) => {
      const label = named ? `${zoneName(row)} ${t.zoneLabels[zoneTint(row)] ?? ''}`.trim() : zoneName(row)
      ctx.font = `400 ${size}px ${fonts.text}`
      const labelW = ctx.measureText(`${label} `).width
      const percent = formatPercent(row.percent)
      ctx.font = `700 ${size}px ${fonts.text}`
      const entry = { row, x, label, labelW, percent, size }
      x += SWATCH + SWATCH_GAP + labelW + ctx.measureText(percent).width + LEGEND_COL_GAP
      return entry
    })
    if (x - LEGEND_COL_GAP <= PAD_X + width) break
  }
  return entries
}

const VERDICT_BAR_H = 6
const VERDICT_SEGMENT_GAP = 2
const VERDICT_LABEL = 9
const VERDICT_LABEL_GAP = 6

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

const ZONE_STRIP_H = VERDICT_BAR_H + VERDICT_LABEL_GAP + VERDICT_LABEL

/** The 6 px bar of the run's zones and their percents, under a verdict or a rep pace. */
function drawZoneStrip(ctx: Ctx, { palette, fonts }: ShareCardScene, zones: ShareZones, top: number) {
  const barW = RIGHT - PAD_X
  let at = PAD_X
  for (const row of zones.rows) {
    const w = (row.percent / 100) * barW
    const last = row === zones.rows[zones.rows.length - 1]
    ctx.fillStyle = palette.hrZones[zoneTint(row) - 1] ?? palette.mu
    roundRect(ctx, at, top, Math.max(w - (last ? 0 : VERDICT_SEGMENT_GAP), 1), VERDICT_BAR_H, VERDICT_BAR_H / 2)
    ctx.fill()
    at += w
  }

  ctx.font = `500 ${VERDICT_LABEL}px ${fonts.text}`
  ctx.fillStyle = palette.mu
  ctx.textBaseline = 'top'
  for (const label of zoneBarLabels(zones.rows, PAD_X, barW, (text) => ctx.measureText(text).width)) {
    ctx.textAlign = label.align
    ctx.fillText(label.text, label.x, top + VERDICT_BAR_H + VERDICT_LABEL_GAP)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

const REP_CAPTION = 12
const REP_CAPTION_GAP = 10
const ZONE_STRIP_PAD_BOTTOM = 14

/** The rep pace leads; the zones drop to the strip at the middle's foot. */
function drawRepMiddle(ctx: Ctx, scene: ShareCardScene, headline: ShareRepHeadline, { middleH }: ShareCardLayout) {
  const { activity, palette, fonts } = scene
  const zones = shareZones(activity)
  const detail = shareRepDetail(activity)
  const stripTop = zones ? middleH - ZONE_STRIP_PAD_BOTTOM - ZONE_STRIP_H : middleH
  const detailH = detail ? REP_DETAIL_PAD_TOP + REP_DETAIL_H[detail.kind] : 0
  const top = Math.max(0, (stripTop - (HEADLINE_SIZE + REP_CAPTION_GAP + REP_CAPTION + detailH)) / 2)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `600 ${HEADLINE_LABEL_SIZE}px ${fonts.text}`
  const unitW = ctx.measureText(headline.unit).width
  let size = HEADLINE_SIZE
  const paceFont = () => {
    ctx.font = `700 ${size}px ${fonts.display}`
    setSpacing(ctx, -0.04 * size)
  }
  paceFont()
  while (size > 40 && ctx.measureText(headline.pace).width + HEADLINE_GAP + unitW > RIGHT - PAD_X) {
    size -= 4
    paceFont()
  }
  const baseline = top + Math.round(HEADLINE_SIZE * 0.8)
  ctx.fillStyle = palette.tx
  ctx.fillText(headline.pace, PAD_X, baseline)
  const paceW = ctx.measureText(headline.pace).width
  setSpacing(ctx, 0)
  ctx.font = `600 ${HEADLINE_LABEL_SIZE}px ${fonts.text}`
  ctx.fillText(headline.unit, PAD_X + paceW + HEADLINE_GAP, baseline)

  const captionTop = top + HEADLINE_SIZE + REP_CAPTION_GAP
  ctx.font = `600 ${REP_CAPTION}px ${fonts.text}`
  ctx.fillStyle = repColor(activity, palette)
  ctx.fillText(fit(ctx, headline.caption, RIGHT - PAD_X), PAD_X, captionTop + Math.round(REP_CAPTION * 0.8))

  const ink = { tx: palette.tx, mu: palette.mu, mark: palette.tx }
  if (detail) drawRepDetail(ctx, scene, detail, captionTop + REP_CAPTION + REP_DETAIL_PAD_TOP, ink)
  if (zones) drawZoneStrip(ctx, scene, zones, stripTop)
}

function drawStatsMiddle(ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout) {
  if (layout.repHeadline) drawRepMiddle(ctx, scene, layout.repHeadline, layout)
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

/** The foot of the date and place line, or of the reps' result under it. */
export function headerFoot({ title, result }: Pick<ShareCardLayout, 'title'> & { result?: string | null }): number {
  return TITLE_BASELINE + (title.lines.length - 1) * title.lineHeight + 18 + 3 + (result ? RESULT_H : 0)
}

/** How far above the foot's words its scrim starts to darken. */
const SCRIM_FADE = 40

/**
 * [offset, black's alpha] stops, fixed whatever the photo: .62 to the foot of the header's words (5:1 for the date line on
 * white), clear through the middle, then .62 from the top of the rep pace and stats down to .8 at the foot.
 */
export function photoScrim(headerBottom: number, footerTop: number, height = H): [number, number][] {
  const words = headerBottom / height
  const foot = Math.max(words, (footerTop - SCRIM_FADE) / height)
  const clear = Math.min(foot, Math.max(0.38, words + 0.14))
  return [[0, 0.72], [words, 0.62], [clear, 0], [foot, 0], [Math.min(1, footerTop / height), 0.62], [1, 0.8]]
}

function drawPhoto(ctx: Ctx, photo: HTMLImageElement, layout: ShareCardLayout) {
  const { height } = layout
  drawCover(ctx, photo, W, height)
  const scrim = ctx.createLinearGradient(0, 0, 0, height)
  for (const [offset, alpha] of photoScrim(headerFoot(layout), layout.textBottom, height)) scrim.addColorStop(offset, `rgba(0, 0, 0, ${alpha})`)
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, W, height)
}

/** Two stats spread edge to edge read as unrelated: they sit side by side instead. */
const STAT_PAIR_GAP = 28
/** A single U+2013 en dash: Geist draws it digit-wide, so a clock of dashes read as long rules. */
const PACE_PENDING = '\u2013'

/** Each cell keeps the still card's place, so the row does not shuffle as the video counts up. */
function drawStats(ctx: Ctx, scene: ShareCardScene, top: number, ink: Ink, motion: VideoMotion) {
  const { activity, fonts, palette, progress } = scene
  const stats = shareStats(activity, { repPace: scene.design === 'route' })
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
    return { stat, width: Math.max(valueW + unitW, labelW) }
  })
  const used = cells.reduce((sum, c) => sum + c.width, 0)
  const gap = cells.length > 2 ? (RIGHT - PAD_X - used) / (cells.length - 1) : STAT_PAIR_GAP

  ctx.textAlign = 'left'
  let x = PAD_X
  for (const { stat, width } of cells) {
    let { value, unit } = stat
    let alpha = 1
    let pending = false
    if (progress !== undefined && progress < 1) {
      if (stat.key === 'distance') value = formatKm(activity.distanceKm * progress, 1)
      else if (stat.key === 'time') ({ value, unit } = shareDuration(activity.durationSeconds * progress))
      else if (stat.key === 'pace' || stat.key === 'repPace') ({ value, pending } = { value: PACE_PENDING, pending: true })
    }
    if (progress !== undefined && (stat.key === 'pace' || stat.key === 'repPace' || stat.key === 'hr')) {
      alpha = progress < 1 ? 0.35 : 0.35 + 0.65 * motion.finish
    }
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.textBaseline = 'alphabetic'
    ctx.font = valueFont
    ctx.fillStyle = pending ? ink.mu : ink.tx
    ctx.fillText(value, x, top + 13)
    if (unit) {
      const valueW = ctx.measureText(value).width
      ctx.font = unitFont
      ctx.fillStyle = ink.mu
      ctx.fillText(unit, x + valueW, top + 13)
    }
    ctx.textBaseline = 'top'
    const rep = stat.key === 'repPace'
    ctx.font = rep ? `600 9.5px ${fonts.text}` : labelFont
    ctx.fillStyle = rep ? repColor(activity, palette) : ink.mu
    ctx.fillText(stat.label, x, top + 19)
    ctx.restore()
    x += width + gap
  }
}

const MIDDLES: Record<Exclude<ShareDesign, 'route'>, (ctx: Ctx, scene: ShareCardScene, layout: ShareCardLayout) => void> = {
  stats: drawStatsMiddle,
  photo: drawPhotoEmpty,
}

export function drawShareCard(ctx: Ctx, scene: ShareCardScene) {
  const layout = shareCardLayout(ctx, scene.activity, scene.fonts, scene.design, scene.size)
  const motion = sceneMotion(scene)
  const { palette } = scene
  const { height } = layout
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, height)

  const photo = scene.design === 'photo' ? scene.photo : null
  if (photo) {
    drawPhoto(ctx, photo, layout)
  } else if (scene.design === 'route') {
    drawMapLayer(ctx, scene, layout, motion)
    drawBands(ctx, scene, layout)
    // Over the bands, so the stats' fade does not cover it.
    if (hasReps(scene)) drawRepsLegend(ctx, scene, layout.textTop)
  } else {
    if (scene.design === 'stats') drawGlow(ctx, scene, height)
    ctx.save()
    ctx.translate(0, layout.middleTop)
    ctx.beginPath()
    ctx.rect(0, 0, W, layout.middleH)
    ctx.clip()
    MIDDLES[scene.design](ctx, scene, layout)
    ctx.restore()
  }

  const ink = photo ? PHOTO_INK : { tx: palette.tx, mu: palette.mu, mark: palette.tx }
  if (layout.ruleY !== null) {
    ctx.fillStyle = palette.card
    ctx.fillRect(0, layout.ruleY, W, height - layout.ruleY)
    ctx.fillStyle = palette.line
    ctx.fillRect(0, layout.ruleY, W, 1)
  }
  drawHeader(ctx, scene, layout, ink)
  if (layout.hero) drawHero(ctx, scene, layout.hero, layout.heroTop, ink)
  if (layout.repDetail) drawRepDetail(ctx, scene, layout.repDetail, layout.repDetailTop, ink)
  drawStats(ctx, scene, layout.statsTop, ink, motion)
}
