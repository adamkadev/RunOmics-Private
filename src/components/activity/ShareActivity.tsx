'use client'

import { useEffect, useRef, useState } from 'react'
import { Share2, Download, Copy, Check, Loader2 } from 'lucide-react'
import type { ActivityType } from '@/domain/activity/types'
import { formatDuration, formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
  avgHeartRate: number | null
  date: string
  type: ActivityType
  polyline: string | null
}

const SIZE = 1080
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const MAP_STYLE = 'backdrop-v4-dark'

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  try {
    ;(ctx as unknown as { letterSpacing: string }).letterSpacing = value
  } catch {
    /* noop */
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Fetch a static MapTiler image of the route, or null if unavailable (no token,
// no GPS, or the request / CORS fails).
async function loadRouteMap(polyline: string | null): Promise<HTMLImageElement | null> {
  const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!polyline || !token) return null
  const path = `stroke:0x34d399|width:6|enc:${encodeURIComponent(polyline)}`
  const url = `https://api.maptiler.com/maps/${MAP_STYLE}/static/auto/${SIZE}x${SIZE}.png?key=${token}&padding=80&path=${path}`
  try {
    return await loadImage(url)
  } catch {
    return null
  }
}

function drawCard(ctx: CanvasRenderingContext2D, p: Props, map: HTMLImageElement | null) {
  // Base background
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE)
  bg.addColorStop(0, '#0b1426')
  bg.addColorStop(1, '#030712')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)

  if (map) {
    ctx.drawImage(map, 0, 0, SIZE, SIZE)
    // Dark scrim for text legibility: stronger at top & bottom, lighter in the middle.
    const scrim = ctx.createLinearGradient(0, 0, 0, SIZE)
    scrim.addColorStop(0, 'rgba(3,7,18,0.88)')
    scrim.addColorStop(0.4, 'rgba(3,7,18,0.45)')
    scrim.addColorStop(0.62, 'rgba(3,7,18,0.5)')
    scrim.addColorStop(1, 'rgba(3,7,18,0.92)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, SIZE, SIZE)
  } else {
    const glow = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.05, 0, SIZE * 0.5, SIZE * 0.05, SIZE * 0.8)
    glow.addColorStop(0, 'rgba(16,185,129,0.20)')
    glow.addColorStop(1, 'rgba(16,185,129,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, SIZE, SIZE)
  }

  const pad = 88
  ctx.textBaseline = 'alphabetic'

  // Brand (top-left)
  ctx.textAlign = 'left'
  ctx.font = `700 50px ${FONT}`
  ctx.fillStyle = '#f8fafc'
  ctx.fillText(t.brand.namePrefix, pad, 128)
  const runW = ctx.measureText(t.brand.namePrefix).width
  ctx.font = `300 50px ${FONT}`
  ctx.fillStyle = '#cbd5e1'
  ctx.fillText(t.brand.nameSuffix, pad + runW, 128)

  // Date (top-right)
  const dateLabel = new Date(p.date + 'T12:00:00')
    .toLocaleDateString(t.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase()
  ctx.textAlign = 'right'
  setLetterSpacing(ctx, '2px')
  ctx.font = `500 28px ${FONT}`
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(dateLabel, SIZE - pad, 122)

  // Activity type (emerald, under brand)
  ctx.textAlign = 'left'
  setLetterSpacing(ctx, '4px')
  ctx.font = `600 30px ${FONT}`
  ctx.fillStyle = '#34d399'
  ctx.fillText(t.activityTypes[p.type].toUpperCase(), pad, 186)

  // DISTANCE label
  ctx.fillStyle = '#94a3b8'
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(t.activity.shareCard.distance, pad, 470)

  // Big distance number
  setLetterSpacing(ctx, '0px')
  ctx.fillStyle = '#f8fafc'
  ctx.font = `800 210px ${FONT}`
  const distStr = p.distanceKm.toFixed(1)
  ctx.fillText(distStr, pad - 6, 670)
  const distW = ctx.measureText(distStr).width
  ctx.fillStyle = '#34d399'
  ctx.font = `700 64px ${FONT}`
  ctx.fillText('km', pad + distW + 18, 670)

  // Divider
  ctx.strokeStyle = 'rgba(148,163,184,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pad, 800)
  ctx.lineTo(SIZE - pad, 800)
  ctx.stroke()

  // 3-metric row (no elevation)
  const metrics = [
    { label: t.activity.shareCard.time, value: formatDuration(p.durationSeconds) },
    { label: t.activity.shareCard.pace, value: p.paceSecPerKm ? formatClock(p.paceSecPerKm) : '-' },
    { label: t.activity.shareCard.avgHr, value: p.avgHeartRate ? String(p.avgHeartRate) : '-' },
  ]
  const colW = (SIZE - pad * 2) / 3
  metrics.forEach((m, i) => {
    const x = pad + i * colW
    ctx.textAlign = 'left'
    setLetterSpacing(ctx, '3px')
    ctx.fillStyle = '#94a3b8'
    ctx.font = `600 26px ${FONT}`
    ctx.fillText(m.label, x, 900)
    setLetterSpacing(ctx, '0px')
    ctx.fillStyle = '#f8fafc'
    ctx.font = `700 78px ${FONT}`
    ctx.fillText(m.value, x, 982)
  })

  // Watermark
  ctx.textAlign = 'center'
  setLetterSpacing(ctx, '4px')
  ctx.font = `500 24px ${FONT}`
  ctx.fillStyle = '#64748b'
  ctx.fillText(`${t.brand.namePrefix}${t.brand.nameSuffix}`.toLowerCase(), SIZE / 2, SIZE - 50)
  setLetterSpacing(ctx, '0px')
}

async function renderBlob(props: Props): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await (document.fonts?.ready ?? Promise.resolve())
  const map = await loadRouteMap(props.polyline)
  drawCard(ctx, props, map)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function ShareActivity(props: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const blobRef = useRef<Blob | null>(null)

  // Reset the cached image if the activity changes.
  useEffect(() => {
    blobRef.current = null
  }, [props.date, props.distanceKm])

  async function ensureBlob(): Promise<Blob | null> {
    if (blobRef.current) return blobRef.current
    const blob = await renderBlob(props)
    blobRef.current = blob
    return blob
  }

  function fileName() {
    return `runomics-${props.date}.png`
  }

  async function nativeShare() {
    const blob = await ensureBlob()
    if (!blob) return
    const file = new File([blob], fileName(), { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file] })
    } else {
      download(blob)
    }
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName()
    a.click()
    URL.revokeObjectURL(url)
  }

  async function run(action: 'share' | 'download' | 'copy') {
    setBusy(true)
    try {
      const blob = await ensureBlob()
      if (!blob) return
      if (action === 'share') await nativeShare()
      else if (action === 'download') download(blob)
      else if (action === 'copy') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* cancelled or unsupported */
    } finally {
      setBusy(false)
      if (action !== 'copy') setOpen(false)
    }
  }

  const canShare =
    typeof navigator !== 'undefined' &&
    'canShare' in navigator
  const canCopy = typeof window !== 'undefined' && 'ClipboardItem' in window

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        {t.activity.share}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
            {canShare && (
              <MenuItem icon={<Share2 size={15} />} label={t.activity.shareMenu.share} onClick={() => run('share')} />
            )}
            <MenuItem icon={<Download size={15} />} label={t.activity.shareMenu.download} onClick={() => run('download')} />
            {canCopy && (
              <MenuItem
                icon={copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                label={copied ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
                onClick={() => run('copy')}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/90 transition-colors hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  )
}
