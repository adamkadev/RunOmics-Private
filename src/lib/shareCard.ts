import type { Activity } from '@/domain/activity/types'
import { formatDateWithYear, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { CHART_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

const WIDTH = 1080
const HEIGHT = 1350
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

function loadImage(src: string): Promise<HTMLImageElement> {
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

function drawCard(ctx: CanvasRenderingContext2D, activity: Activity, icon: HTMLImageElement | null) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, '#0f172a')
  gradient.addColorStop(1, '#020617')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = CHART_COLORS.brand
  ctx.fillRect(0, 0, WIDTH, 12)

  ctx.textBaseline = 'alphabetic'
  if (icon) ctx.drawImage(icon, MARGIN, 96, 56, 56)
  ctx.fillStyle = '#f8fafc'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText(`${t.brand.namePrefix}${t.brand.nameSuffix}`, icon ? MARGIN + 72 : MARGIN, 138)

  const title = activity.description || t.activity.runTitle(activity.dayOfWeek)
  ctx.font = '700 60px system-ui, sans-serif'
  ctx.fillStyle = '#f8fafc'
  const titleLines = wrapTitle(ctx, title, WIDTH - MARGIN * 2)
  let titleY = 320
  for (const line of titleLines) {
    ctx.fillText(line, MARGIN, titleY)
    titleY += 70
  }

  ctx.font = '400 34px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(formatDateWithYear(activity.date), MARGIN, titleY + 16)

  const stats = buildShareStats(activity)
  const cols = 2
  const cellWidth = (WIDTH - MARGIN * 2) / cols
  const rowHeight = 190
  const gridTop = HEIGHT - Math.ceil(stats.length / cols) * rowHeight - 96

  stats.forEach((stat, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = MARGIN + col * cellWidth
    const y = gridTop + row * rowHeight

    ctx.font = '700 76px system-ui, sans-serif'
    ctx.fillStyle = CHART_COLORS.brand
    ctx.fillText(stat.value, x, y)

    ctx.font = '600 28px system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(stat.label, x, y + 40)
  })
}

/** Renders an activity as a shareable PNG card (Canvas 2D, no external deps). */
export async function generateShareCardBlob(activity: Activity): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const icon = await loadImage('/icon-192.png').catch(() => null)
  drawCard(ctx, activity, icon)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/png')
  })
}

export function shareCardFileName(activity: Activity): string {
  return `runomics-${activity.date}.png`
}
