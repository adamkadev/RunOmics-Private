import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { type AccentId } from '@/lib/accent'
import { t } from '@/i18n'

export type ShareDesign = 'aurora' | 'nuit' | 'eclat' | 'terrain' | 'souvenir'
export const SHARE_DESIGNS: ShareDesign[] = ['aurora', 'nuit', 'eclat', 'terrain', 'souvenir']

const W = 1080
const H = 1920
const M = 80

// Route circle geometry
const CX = W / 2
const CY = 870
const CR = 330

// Stats glass card
const STATS_Y = 1400
const STATS_H = 420

interface DesignPalette {
  bg: string
  showBlobs: boolean
  blob1: string; blob2: string; blob1Op: number; blob2Op: number
  titleColor: string; dateColor: string; brandColor: string
  circleBg: string; routeColor: string
  statsBg: string; statsBorder: string
  valueColor: string; labelColor: string; secondaryColor: string
  isTerrain: boolean; isPhoto: boolean
}

interface AccentColors {
  lightBg: string
  la1: string; la2: string; la1Op: number; la2Op: number
  lightAccent: string; lightText: string; lightCircle: string
  darkBg: string
  da1: string; da2: string; da1Op: number; da2Op: number
  darkAccent: string; darkText: string; darkCircle: string
}

const ACCENT_COLORS: Record<AccentId, AccentColors> = {
  nature: {
    lightBg: '#eef3f0',
    la1: '#a7f3d6', la2: '#bcd6ff', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#0e9f6e', lightText: '#059669', lightCircle: 'rgba(14,159,110,0.05)',
    darkBg: '#070f0c',
    da1: '#0e9f6e', da2: '#1276b8', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#10b981', darkText: '#2ed9a0', darkCircle: 'rgba(16,185,129,0.07)',
  },
  performance: {
    lightBg: '#eff6ff',
    la1: '#93c5fd', la2: '#bae6fd', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#3b82f6', lightText: '#2563eb', lightCircle: 'rgba(59,130,246,0.05)',
    darkBg: '#06091a',
    da1: '#1d4ed8', da2: '#0284c7', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#3b82f6', darkText: '#60a5fa', darkCircle: 'rgba(59,130,246,0.07)',
  },
  impact: {
    lightBg: '#fff1f2',
    la1: '#fda4af', la2: '#fbcfe8', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#f43f5e', lightText: '#e11d48', lightCircle: 'rgba(244,63,94,0.05)',
    darkBg: '#130608',
    da1: '#be185d', da2: '#9d174d', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#f43f5e', darkText: '#fb7185', darkCircle: 'rgba(244,63,94,0.07)',
  },
  motivation: {
    lightBg: '#fff7ed',
    la1: '#fdba74', la2: '#fde68a', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#f97316', lightText: '#ea580c', lightCircle: 'rgba(249,115,22,0.05)',
    darkBg: '#130a04',
    da1: '#c2410c', da2: '#b45309', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#f97316', darkText: '#fb923c', darkCircle: 'rgba(249,115,22,0.07)',
  },
  endurance: {
    lightBg: '#f5f3ff',
    la1: '#c4b5fd', la2: '#e9d5ff', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#8b5cf6', lightText: '#7c3aed', lightCircle: 'rgba(139,92,246,0.05)',
    darkBg: '#0d0a1a',
    da1: '#6d28d9', da2: '#7e22ce', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#8b5cf6', darkText: '#a78bfa', darkCircle: 'rgba(139,92,246,0.07)',
  },
}

function resolveDesignPalette(design: ShareDesign, accent: AccentId): DesignPalette {
  const a = ACCENT_COLORS[accent]
  switch (design) {
    case 'aurora':
      return {
        bg: a.lightBg, showBlobs: true,
        blob1: a.la1, blob2: a.la2, blob1Op: a.la1Op, blob2Op: a.la2Op,
        titleColor: '#0f172a', dateColor: '#64748b', brandColor: '#0f172a',
        circleBg: a.lightCircle, routeColor: a.lightAccent,
        statsBg: 'rgba(255,255,255,0.68)', statsBorder: 'rgba(255,255,255,0.82)',
        valueColor: a.lightText, labelColor: '#64748b', secondaryColor: '#1e293b',
        isTerrain: false, isPhoto: false,
      }
    case 'nuit':
      return {
        bg: a.darkBg, showBlobs: true,
        blob1: a.da1, blob2: a.da2, blob1Op: a.da1Op, blob2Op: a.da2Op,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        circleBg: a.darkCircle, routeColor: a.darkText,
        statsBg: 'rgba(255,255,255,0.07)', statsBorder: 'rgba(255,255,255,0.13)',
        valueColor: a.darkText, labelColor: 'rgba(255,255,255,0.42)', secondaryColor: 'rgba(255,255,255,0.88)',
        isTerrain: false, isPhoto: false,
      }
    case 'eclat':
      return {
        bg: '#f8fafc', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        titleColor: '#0f172a', dateColor: '#94a3b8', brandColor: '#0f172a',
        circleBg: 'rgba(0,0,0,0.035)', routeColor: '#475569',
        statsBg: 'rgba(0,0,0,0.025)', statsBorder: 'rgba(0,0,0,0.08)',
        valueColor: '#0f172a', labelColor: '#94a3b8', secondaryColor: '#334155',
        isTerrain: false, isPhoto: false,
      }
    case 'terrain':
      return {
        bg: '#0f172a', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        circleBg: a.darkCircle, routeColor: a.darkText,
        statsBg: 'rgba(255,255,255,0.06)', statsBorder: 'rgba(255,255,255,0.10)',
        valueColor: a.darkText, labelColor: 'rgba(255,255,255,0.38)', secondaryColor: 'rgba(255,255,255,0.78)',
        isTerrain: true, isPhoto: false,
      }
    case 'souvenir':
      return {
        bg: '#1e3a5f', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.62)', brandColor: '#ffffff',
        circleBg: 'rgba(255,255,255,0.04)', routeColor: 'rgba(255,255,255,0.72)',
        statsBg: 'rgba(0,0,0,0.42)', statsBorder: 'rgba(255,255,255,0.12)',
        valueColor: '#ffffff', labelColor: 'rgba(255,255,255,0.45)', secondaryColor: 'rgba(255,255,255,0.88)',
        isTerrain: false, isPhoto: true,
      }
  }
}

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

function drawTerrainGrid(ctx: CanvasRenderingContext2D) {
  const step = 80
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.042)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H) }
  for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y) }
  ctx.stroke()
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

function projectRoute(route: [number, number][]): { x: number; y: number }[] {
  const avgLat = route.reduce((s, [, lat]) => s + lat, 0) / route.length
  const cos = Math.cos((avgLat * Math.PI) / 180)
  return route.map(([lng, lat]) => ({ x: lng * cos, y: -lat }))
}

function drawRouteInCircle(ctx: CanvasRenderingContext2D, route: [number, number][], color: string, circleBg: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(CX, CY, CR, 0, Math.PI * 2)
  ctx.fillStyle = circleBg
  ctx.fill()
  ctx.restore()

  const pts = projectRoute(route)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const scale = (CR * 1.56) / span
  const ox = CX - ((minX + maxX) / 2) * scale
  const oy = CY - ((minY + maxY) / 2) * scale

  ctx.save()
  ctx.beginPath()
  ctx.arc(CX, CY, CR * 0.88, 0, Math.PI * 2)
  ctx.clip()

  ctx.beginPath()
  pts.forEach((p, i) => {
    const x = p.x * scale + ox
    const y = p.y * scale + oy
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
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

function drawHeader(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  const title = activity.description || t.activity.runTitle(activity.dayOfWeek)

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
  const lines = wrapTitle(ctx, title, W - M * 2 - 90)
  let y = 260
  for (const line of lines) {
    ctx.fillText(line, M, y)
    y += 80
  }

  ctx.font = '400 42px system-ui, sans-serif'
  ctx.fillStyle = p.dateColor
  ctx.fillText(formatDateWithYear(activity.date), M, y + 16)
}

function drawStatsCard(ctx: CanvasRenderingContext2D, activity: Activity, p: DesignPalette) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(M, STATS_Y, W - M * 2, STATS_H, 44)
  ctx.fillStyle = p.statsBg
  ctx.fill()
  ctx.strokeStyle = p.statsBorder
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  const stats: { value: string; label: string; big: boolean }[] = [
    { value: formatDistance(activity.distanceKm), label: t.activity.shareCard.distance, big: true },
    { value: formatDuration(activity.durationSeconds), label: t.activity.shareCard.time, big: true },
  ]
  if (activity.paceSecPerKm) stats.push({ value: formatPace(activity.paceSecPerKm), label: t.activity.shareCard.pace, big: false })
  if (activity.avgHeartRate) stats.push({ value: `${activity.avgHeartRate} bpm`, label: t.activity.shareCard.avgHr, big: false })

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

export interface RenderOptions {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  showMap: boolean
  photoImage?: HTMLImageElement | null
}

export function renderShareCard(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { activity, design, accent, showMap, photoImage } = options
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const p = resolveDesignPalette(design, accent)

  ctx.clearRect(0, 0, W, H)

  // Background
  if (design === 'souvenir' && photoImage) {
    drawCover(ctx, photoImage, 0, 0, W, H)
  } else {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
  }

  // Aurora blobs
  if (p.showBlobs) {
    drawBlob(ctx, W * 0.15, H * 0.18, W * 0.88, p.blob1, p.blob1Op)
    drawBlob(ctx, W * 0.88, H * 0.34, W * 0.75, p.blob2, p.blob2Op)
  }

  // Terrain grid overlay
  if (p.isTerrain) drawTerrainGrid(ctx)

  // Photo scrims
  if (p.isPhoto && photoImage) drawPhotoScrims(ctx)

  // Header
  drawHeader(ctx, activity, p)

  // Route
  const hasRoute = !!activity.route && activity.route.length > 1
  if (showMap && hasRoute) {
    drawRouteInCircle(ctx, activity.route!, p.routeColor, p.circleBg)
  } else if (!showMap) {
    // Subtle empty circle as placeholder
    ctx.save()
    ctx.beginPath()
    ctx.arc(CX, CY, CR, 0, Math.PI * 2)
    ctx.fillStyle = p.circleBg
    ctx.fill()
    ctx.restore()
  }

  // Stats card
  drawStatsCard(ctx, activity, p)
}

export function shareCardFileName(activity: Activity, design: ShareDesign): string {
  return `runomics-${activity.date}-${design}.png`
}
