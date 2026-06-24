'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, ImagePlus, Share2, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import {
  SHARE_DESIGNS,
  loadImage,
  renderShareCard,
  shareCardFileName,
  type ShareDesign,
} from '@/lib/shareCard'
import { ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

function currentAccent(): AccentId {
  if (typeof document === 'undefined') return DEFAULT_ACCENT
  const v = document.documentElement.getAttribute('data-accent')
  return isAccentId(v) ? v : DEFAULT_ACCENT
}

// ── Accent color tokens ────────────────────────────────────────────

type DesignAccent = 'nature' | 'performance' | 'impact' | 'motivation' | 'endurance'

const ACCENT_TOKENS: Record<DesignAccent, {
  barColor: string
  canvasLight: string; a1Light: string; a2Light: string; a1opLight: number; a2opLight: number; accentLight: string
  canvasDark: string; a1Dark: string; a2Dark: string; a1opDark: number; a2opDark: number; accentDark: string; accentTextDark: string
}> = {
  nature: {
    barColor: '#059669',
    canvasLight: 'linear-gradient(155deg,#f0fef8 0%,#ecf9f4 100%)', a1Light: '#86efac', a2Light: '#6ee7b7', a1opLight: 0.58, a2opLight: 0.50, accentLight: '#059669',
    canvasDark: 'linear-gradient(155deg,#064e3b 0%,#082f39 100%)', a1Dark: '#10b981', a2Dark: '#34d399', a1opDark: 0.45, a2opDark: 0.38, accentDark: '#10b981', accentTextDark: '#6ee7b7',
  },
  performance: {
    barColor: '#2563eb',
    canvasLight: 'linear-gradient(155deg,#f0f7ff 0%,#eff2ff 100%)', a1Light: '#60a5fa', a2Light: '#93c5fd', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#2563eb',
    canvasDark: 'linear-gradient(155deg,#1e3a8a 0%,#0c2340 100%)', a1Dark: '#3b82f6', a2Dark: '#60a5fa', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#3b82f6', accentTextDark: '#93c5fd',
  },
  impact: {
    barColor: '#e11d48',
    canvasLight: 'linear-gradient(155deg,#fff5f8 0%,#fff1f5 100%)', a1Light: '#f472b6', a2Light: '#f87db8', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#e11d48',
    canvasDark: 'linear-gradient(155deg,#831843 0%,#500724 100%)', a1Dark: '#f43f5e', a2Dark: '#f472b6', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#f43f5e', accentTextDark: '#fb7185',
  },
  motivation: {
    barColor: '#ea580c',
    canvasLight: 'linear-gradient(155deg,#fffbf0 0%,#fff8f0 100%)', a1Light: '#fb923c', a2Light: '#fdba74', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#ea580c',
    canvasDark: 'linear-gradient(155deg,#7c2d12 0%,#431407 100%)', a1Dark: '#f97316', a2Dark: '#fb923c', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#f97316', accentTextDark: '#fdba74',
  },
  endurance: {
    barColor: '#7c3aed',
    canvasLight: 'linear-gradient(155deg,#faf8ff 0%,#f5f3ff 100%)', a1Light: '#a78bfa', a2Light: '#c4b5fd', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#7c3aed',
    canvasDark: 'linear-gradient(155deg,#4c1d95 0%,#2e1065 100%)', a1Dark: '#8b5cf6', a2Dark: '#a78bfa', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#8b5cf6', accentTextDark: '#c4b5fd',
  },
}

interface DesignConfig {
  bg: string
  showBlobs: boolean
  blob1: string; blob2: string; blob1Op: number; blob2Op: number
  isLight: boolean
  titleColor: string; subtitleColor: string; brandColor: string
  mapCircleBg: string; routeColor: string
  statsBg: string; statsBorder: string; accentColor: string; statsLabelColor: string; statsPrimaryColor: string
  isTerrain: boolean; isPhoto: boolean
}

function getDesignConfig(design: ShareDesign, accent: DesignAccent): DesignConfig {
  const t = ACCENT_TOKENS[accent]

  switch (design) {
    case 'aurora':
      return {
        bg: t.canvasLight, showBlobs: true,
        blob1: t.a1Light, blob2: t.a2Light, blob1Op: t.a1opLight, blob2Op: t.a2opLight,
        isLight: true,
        titleColor: '#0f172a', subtitleColor: '#64748b', brandColor: '#0f172a',
        mapCircleBg: 'rgba(59,130,246,0.05)', routeColor: t.accentLight,
        statsBg: 'rgba(255,255,255,0.68)', statsBorder: 'rgba(255,255,255,0.82)',
        accentColor: t.accentLight, statsLabelColor: '#64748b', statsPrimaryColor: '#1e293b',
        isTerrain: false, isPhoto: false,
      }
    case 'nuit':
      return {
        bg: t.canvasDark, showBlobs: true,
        blob1: t.a1Dark, blob2: t.a2Dark, blob1Op: t.a1opDark, blob2Op: t.a2opDark,
        isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        mapCircleBg: 'rgba(59,130,246,0.07)', routeColor: t.accentTextDark,
        statsBg: 'rgba(255,255,255,0.07)', statsBorder: 'rgba(255,255,255,0.13)',
        accentColor: t.accentTextDark, statsLabelColor: 'rgba(255,255,255,0.42)', statsPrimaryColor: 'rgba(255,255,255,0.88)',
        isTerrain: false, isPhoto: false,
      }
    case 'eclat':
      return {
        bg: 'linear-gradient(150deg,#ffffff 0%,#f1f5f9 100%)', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        isLight: true,
        titleColor: '#0f172a', subtitleColor: '#94a3b8', brandColor: '#0f172a',
        mapCircleBg: 'rgba(0,0,0,0.035)', routeColor: '#475569',
        statsBg: 'rgba(0,0,0,0.025)', statsBorder: 'rgba(0,0,0,0.08)',
        accentColor: '#0f172a', statsLabelColor: '#94a3b8', statsPrimaryColor: '#334155',
        isTerrain: false, isPhoto: false,
      }
    case 'terrain':
      return {
        bg: '#0f172a', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        mapCircleBg: 'rgba(59,130,246,0.06)', routeColor: t.accentTextDark,
        statsBg: 'rgba(255,255,255,0.06)', statsBorder: 'rgba(255,255,255,0.10)',
        accentColor: t.accentTextDark, statsLabelColor: 'rgba(255,255,255,0.38)', statsPrimaryColor: 'rgba(255,255,255,0.78)',
        isTerrain: true, isPhoto: false,
      }
    case 'souvenir':
      return {
        bg: 'linear-gradient(145deg,#1e1b4b 0%,#312e81 45%,#1e3a5f 100%)', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.62)', brandColor: '#ffffff',
        mapCircleBg: 'rgba(255,255,255,0.04)', routeColor: 'rgba(255,255,255,0.72)',
        statsBg: 'rgba(0,0,0,0.62)', statsBorder: 'rgba(255,255,255,0.12)',
        accentColor: '#ffffff', statsLabelColor: 'rgba(255,255,255,0.45)', statsPrimaryColor: 'rgba(255,255,255,0.88)',
        isTerrain: false, isPhoto: true,
      }
  }
}

const ROUTE_POINTS = '96,20 108,22 119,27 130,35 140,46 147,60 151,75 151,90 147,105 139,118 128,127 115,132 101,133 87,130 74,122 63,110 56,96 52,81 55,66 63,53 75,42 87,32 96,20'

function BlobAnimation() {
  return (
    <style>{`
      @keyframes ro-aurora {
        0% { transform: translate3d(0,0,0) scale(1); }
        50% { transform: translate3d(4%,-3%,0) scale(1.12); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      @keyframes ro-aurora2 {
        0% { transform: translate3d(0,0,0) scale(1.05); }
        50% { transform: translate3d(-5%,4%,0) scale(1); }
        100% { transform: translate3d(0,0,0) scale(1.05); }
      }
    `}</style>
  )
}

function DesignPreview({ design, accent, showMap, photoUrl, onPickPhoto }: {
  design: ShareDesign; accent: DesignAccent; showMap: boolean
  photoUrl?: string | null; onPickPhoto?: () => void
}) {
  const config = getDesignConfig(design, accent)
  const isTerrain = design === 'terrain'
  const effectiveShowMap = showMap || isTerrain
  const barColor = ACCENT_TOKENS[accent].barColor
  const isSouvenir = design === 'souvenir'

  return (
    <>
      <BlobAnimation />
      <div
        className="relative overflow-hidden rounded-[22px]"
        style={{
          width: 258,
          height: 368,
          background: isSouvenir && photoUrl ? 'transparent' : config.bg,
          boxShadow: '0 20px 56px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.08)',
        }}
      >
        {/* Photo background (Souvenir with photo) */}
        {isSouvenir && photoUrl && (
          <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {/* Photo placeholder (Souvenir without photo) */}
        {isSouvenir && !photoUrl && onPickPhoto && (
          <button
            onClick={onPickPhoto}
            style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <ImagePlus size={28} color="rgba(255,255,255,0.45)" strokeWidth={1.5} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>{t.activity.shareCard.choosePhoto}</span>
          </button>
        )}
        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: barColor, zIndex: 10 }} />

        {/* Branding badge */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 0,
            width: 22,
            height: 90,
            background: config.isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.14)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            borderBottomLeftRadius: 9,
            borderLeft: '0.5px solid',
            borderBottom: '0.5px solid',
            borderTop: '0.5px solid',
            borderColor: config.isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 12,
          }}
        >
          <span
            style={{
              writingMode: 'vertical-rl',
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: config.brandColor,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            RunOmics
          </span>
        </div>

        {/* Blobs (Aurora/Nuit only) */}
        {config.showBlobs && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                width: '95%',
                height: '95%',
                left: '-28%',
                top: '-30%',
                borderRadius: 9999,
                filter: 'blur(38px)',
                background: `radial-gradient(circle, ${config.blob1} 0%, transparent 60%)`,
                opacity: config.blob1Op,
                animation: 'ro-aurora 16s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '85%',
                height: '85%',
                right: '-28%',
                top: '15%',
                borderRadius: 9999,
                filter: 'blur(32px)',
                background: `radial-gradient(circle, ${config.blob2} 0%, transparent 60%)`,
                opacity: config.blob2Op,
                animation: 'ro-aurora2 20s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {/* Terrain topographic */}
        {isTerrain && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 258 368" preserveAspectRatio="xMidYMid slice">
            <g fill="none">
              <path d="M129,159 Q133,155 133,150 Q132,144 128,143 Q124,142 121,146 Q118,151 119,157 Q120,161 123,163 Q125,165 125,170 Q124,175 126,179 Q128,182 131,179 Q133,175 131,170 Q129,165 129,159 Z" stroke={config.routeColor} strokeWidth="0.85" opacity="0.60" />
              <ellipse cx="126" cy="165" rx="16" ry="22" transform="rotate(-18,126,165)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.48" />
              <ellipse cx="124" cy="168" rx="30" ry="42" transform="rotate(-13,124,168)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.37" />
              <ellipse cx="126" cy="172" rx="47" ry="65" transform="rotate(-9,126,172)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.28" />
              <ellipse cx="128" cy="176" rx="67" ry="93" transform="rotate(-6,128,176)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.21" />
              <ellipse cx="126" cy="180" rx="89" ry="123" transform="rotate(-4,126,180)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.15" />
              <ellipse cx="128" cy="184" rx="113" ry="158" transform="rotate(-2,128,184)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.10" />
              <ellipse cx="124" cy="188" rx="138" ry="192" transform="rotate(-1,124,188)" stroke={config.routeColor} strokeWidth="0.85" fill="none" opacity="0.07" />
            </g>
          </svg>
        )}

        {/* Photo scrims (Souvenir only) */}
        {design === 'souvenir' && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 175, background: 'linear-gradient(180deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.28) 65%, transparent 100%)', zIndex: 1 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 265, background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.68) 42%, transparent 100%)', zIndex: 1 }} />
          </>
        )}

        {/* Card content */}
        <div style={{ position: 'absolute', inset: 0, padding: 17, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
          {/* Top: title */}
          <div style={{ marginBottom: 0, paddingRight: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: config.titleColor, letterSpacing: '-0.025em', lineHeight: 1.2 }}>Metz · 8km</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: config.subtitleColor, marginTop: 2, letterSpacing: '0.01em' }}>21 juin 2026</div>
          </div>

          {/* Map circle */}
          {effectiveShowMap && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0 8px' }}>
              <svg viewBox="0 0 200 200" style={{ width: 172, height: 172 }} overflow="visible">
                <circle cx="100" cy="100" r="88" fill={config.mapCircleBg} />
                <polyline points={ROUTE_POINTS} fill="none" stroke={config.routeColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Spacer if no map */}
          {!effectiveShowMap && <div style={{ flex: 1 }} />}

          {/* Stats glass card */}
          <div
            style={{
              background: config.statsBg,
              border: `1px solid ${config.statsBorder}`,
              backdropFilter: 'blur(18px) saturate(1.4)',
              borderRadius: 14,
              padding: '11px 13px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 6px' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, color: config.accentColor }}>9.00</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: config.statsLabelColor, marginTop: 2 }}>km</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, color: config.accentColor }}>54:33</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: config.statsLabelColor, marginTop: 2 }}>durée</div>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: config.statsPrimaryColor }}>6:04 /km</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: config.statsLabelColor, marginTop: 2 }}>allure</div>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: config.statsPrimaryColor }}>149 bpm</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: config.statsLabelColor, marginTop: 2 }}>fc moy.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function DesignThumb({ design, selected, accentHex, onClick }: {
  design: ShareDesign; selected: boolean; accentHex: string; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div style={{
        width: 60, height: 84, borderRadius: 13, overflow: 'hidden', position: 'relative',
        border: selected ? `2px solid ${accentHex}` : '2px solid transparent',
        boxShadow: selected ? `0 0 0 2px ${accentHex}55, 0 4px 12px rgba(0,0,0,0.24)` : '0 2px 6px rgba(0,0,0,0.18)',
        transition: 'border 0.18s, box-shadow 0.18s',
      }}>
        <DesignPreview design={design} accent={'performance'} showMap={true} />
      </div>
      <span className={cn('text-[11px] transition-colors', selected ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground')}>
        {t.activity.shareCard.designLabels[design]}
      </span>
    </button>
  )
}

interface Props {
  activity: Activity
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const [design, setDesign] = useState<ShareDesign>('aurora')
  const [showMap, setShowMap] = useState(true)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const [accent] = useState<AccentId>(currentAccent)
  const accentHex = ACCENT_SWATCHES[accent]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)

  const isTerrain = design === 'terrain'
  const effectiveShowMap = showMap || isTerrain

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderShareCard(canvas, {
      activity,
      design,
      accent,
      showMap: effectiveShowMap,
      photoImage,
    })
  }, [activity, accent, design, effectiveShowMap, photoImage])

  useEffect(() => { redraw() }, [redraw])

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const { style } = document.documentElement
    const prev = style.overflow
    style.overflow = 'hidden'
    return () => { style.overflow = prev }
  }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    loadImage(url)
      .then((img) => {
        if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
        photoUrlRef.current = url
        setPhotoImage(img)
      })
      .catch(() => URL.revokeObjectURL(url))
  }

  async function handleShare() {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], shareCardFileName(activity, design), { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return
    try { await navigator.share({ files: [file] }) }
    catch (err) { if ((err as Error).name !== 'AbortError') console.error(err) }
  }

  async function handleSave() {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await canvasToBlob(canvas)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = shareCardFileName(activity, design)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function handleCopy() {
    const canvas = canvasRef.current
    if (!canvas) return
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })])
      .then(() => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 1500)
      })
      .catch(console.error)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-sheet relative flex max-h-[92vh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-3xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex shrink-0 justify-center pt-3 sm:hidden">
          <span className="h-[5px] w-9 rounded-full bg-foreground/25" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{t.activity.share}</h2>
          <button
            onClick={onClose}
            aria-label={t.activity.shareCard.close}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-foreground/[0.09] text-muted-foreground transition-colors hover:bg-foreground/[0.14]"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Preview card (interactive HTML preview) */}
          <div className="flex justify-center px-5 pb-4">
            <DesignPreview design={design} accent={'performance'} showMap={showMap} />
          </div>

          {/* Hidden canvas for export */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Design picker */}
          <div className="px-5 pb-3">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-foreground/40">
              {t.activity.shareCard.designLabel}
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {SHARE_DESIGNS.map((d) => (
                <DesignThumb
                  key={d}
                  design={d}
                  selected={design === d}
                  accentHex={accentHex}
                  onClick={() => setDesign(d)}
                />
              ))}
            </div>
          </div>

          {/* Map toggle */}
          <div
            className="flex items-center justify-between border-t border-foreground/[0.07] px-5 py-3"
            style={{ opacity: isTerrain ? 0.42 : 1, transition: 'opacity 0.2s', pointerEvents: isTerrain ? 'none' : 'auto' }}
          >
            <div>
              <div className="text-[15px] text-foreground">{t.activity.shareCard.mapToggle}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {isTerrain ? t.activity.shareCard.mapToggleAlways : t.activity.shareCard.mapToggleNote}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { if (!isTerrain) setShowMap((m) => !m) }}
              aria-pressed={effectiveShowMap}
              className="relative ml-4 h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
              style={{ background: effectiveShowMap ? accentHex : 'rgba(120,120,128,0.22)' }}
            >
              <span
                className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.28)] transition-[left] duration-200"
                style={{ left: effectiveShowMap ? 22 : 2 }}
              />
            </button>
          </div>

          {/* Photo picker (Souvenir only) */}
          {design === 'souvenir' && (
            <div className="flex items-center justify-between border-t border-foreground/[0.07] px-5 py-3">
              <div className="text-[15px] text-foreground">{t.activity.shareCard.photoLabel}</div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-[10px] border border-accent/25 bg-accent/10 px-4 py-2 text-[13px] font-semibold text-accent-text transition-colors hover:bg-accent/15"
              >
                {t.activity.shareCard.choosePhoto}
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 gap-2.5 border-t border-foreground/[0.07] p-4">
          {canShareFiles ? (
            <Button onClick={handleShare} className="flex-[1.5] h-[50px]">
              <Share2 size={15} />
              {t.activity.shareMenu.share}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={handleSave} className="flex-1 h-[50px]">
            <Download size={15} />
            {t.activity.shareMenu.download}
          </Button>
          {canCopyImage && (
            <Button
              variant="secondary"
              onClick={handleCopy}
              className={cn('flex-1 h-[50px]', copyState === 'copied' && 'text-accent-text')}
            >
              {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
              {copyState === 'copied' ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
            </Button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      </div>
    </div>,
    document.body
  )
}
