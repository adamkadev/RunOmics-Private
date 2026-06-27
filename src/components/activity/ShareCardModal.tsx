'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { Check, Copy, Download, Share2, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { SHARE_DESIGNS, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { renderShareCard, shareCardFileName, loadImage } from '@/lib/shareCard'
import { ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'
import { useDragToDismiss } from '@/hooks/useDragToDismiss'
import { t } from '@/i18n'
import { ThemeCard } from '@/components/activity/ShareCardThumbnails'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    })
  })
}

function currentAccent(): AccentId {
  if (typeof document === 'undefined') return DEFAULT_ACCENT
  const v = document.documentElement.getAttribute('data-accent')
  return isAccentId(v) ? v : DEFAULT_ACCENT
}

function readLocalStorage(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

interface ToggleProps {
  on: boolean
  onChange: (v: boolean) => void
  accentHex: string
  disabled?: boolean
}

function Toggle({ on, onChange, accentHex, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative ml-4 h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40"
      style={{ background: on ? accentHex : 'rgba(120,120,128,0.22)' }}
    >
      <span
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.28)] transition-[left] duration-200"
        style={{ left: on ? 22 : 2 }}
      />
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
  const { resolvedTheme } = useTheme()
  const theme: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'

  const [selectedDesign, setSelectedDesign] = useState<ShareDesign>(
    () => {
      const stored = readLocalStorage('ro_shareTheme', 'aurora')
      return (SHARE_DESIGNS as string[]).includes(stored) ? stored as ShareDesign : 'aurora'
    }
  )
  const [showStats, setShowStats] = useState(
    () => readLocalStorage('ro_shareStats', 'true') !== 'false'
  )
  const [showMap, setShowMap] = useState(
    () => readLocalStorage('ro_shareMap', 'true') !== 'false'
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const [accent] = useState<AccentId>(currentAccent)
  const accentHex = ACCENT_SWATCHES[accent]
  const [locationName, setLocationName] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`ro_geocode_${activity.id}`) } catch { return null }
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)

  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)

  // Persist preferences
  useEffect(() => { try { localStorage.setItem('ro_shareTheme', selectedDesign) } catch { /* noop */ } }, [selectedDesign])
  useEffect(() => { try { localStorage.setItem('ro_shareStats', String(showStats)) } catch { /* noop */ } }, [showStats])
  useEffect(() => { try { localStorage.setItem('ro_shareMap', String(showMap)) } catch { /* noop */ } }, [showMap])

  // Reverse geocoding for map watermark (cache is read in state initializer above)
  useEffect(() => {
    if (locationName !== null) return
    if (!activity.route || activity.route.length < 1) return
    const [lng, lat] = activity.route[0]
    const cacheKey = `ro_geocode_${activity.id}`
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`,
      { headers: { 'Accept-Language': 'fr', 'User-Agent': 'RunOmics/1.0' } }
    )
      .then(res => res.json())
      .then((data: { address?: Record<string, string> }) => {
        const addr = data.address ?? {}
        const suburb = addr.suburb ?? addr.neighbourhood
        const city = addr.city ?? addr.town ?? addr.village
        const name = suburb ? `${suburb}, ${city}` : (city ?? null)
        if (name) {
          try { sessionStorage.setItem(cacheKey, name) } catch { /* noop */ }
          setLocationName(name)
        }
      })
      .catch(() => { /* noop */ })
  }, [activity.id, activity.route, locationName])

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Revoke photo object URL on unmount
  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
  }, [])

  const renderOptions = useCallback(() => ({
    activity,
    design: selectedDesign,
    accent,
    theme,
    showStats,
    showMap,
    photoImage,
    gpsRoute: activity.route,
    locationName,
  }), [activity, selectedDesign, accent, theme, showStats, showMap, photoImage, locationName])

  // Redraw preview canvas whenever options change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderShareCard(canvas, renderOptions())
  }, [renderOptions])

  function selectDesign(d: ShareDesign) {
    setSelectedDesign(d)
    if (d === 'memory') setShowStats(false)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    loadImage(url)
      .then((img) => {
        if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
        photoUrlRef.current = url
        setPhotoUrl(url)
        setPhotoImage(img)
      })
      .catch(() => URL.revokeObjectURL(url))
  }

  async function handleSave() {
    const hiCanvas = document.createElement('canvas')
    renderShareCard(hiCanvas, renderOptions(), 3)
    const blob = await canvasToBlob(hiCanvas)
    const file = new File([blob], shareCardFileName(activity, selectedDesign), { type: 'image/png' })

    const isIosPwa = /iPhone|iPad/.test(navigator.userAgent) && 'standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true
    if (isIosPwa && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return }
      catch (err) { if ((err as Error).name !== 'AbortError') console.error(err) }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = file.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleShare() {
    if (!canShareFiles) { await handleSave(); return }
    const hiCanvas = document.createElement('canvas')
    renderShareCard(hiCanvas, renderOptions(), 3)
    const blob = await canvasToBlob(hiCanvas)
    const file = new File([blob], shareCardFileName(activity, selectedDesign), { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return
    try { await navigator.share({ files: [file], title: `${activity.description || 'Run'} - RunOmics` }) }
    catch (err) { if ((err as Error).name !== 'AbortError') console.error(err) }
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

  const isMap = selectedDesign === 'map'
  const isMemory = selectedDesign === 'memory'
  const canRoute = !!activity.route && activity.route.length > 1

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        className="relative flex w-full max-w-md animate-sheet-up flex-col overflow-hidden sm:rounded-2xl"
        style={{
          ...sheetStyle,
          borderRadius: '28px 28px 0 0',
          background: 'rgba(8,18,13,0.92)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden" {...handleProps}>
          <span
            className="rounded-full"
            aria-hidden="true"
            style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.25)' }}
          />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.01em' }}>
            {t.activity.share}
          </h2>
          <button
            onClick={close}
            aria-label={t.activity.shareCard.close}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer',
            }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* Live preview */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 16px' }}>
            <div style={{
              borderRadius: 18, overflow: 'hidden', width: 158, height: 342,
              boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
              flexShrink: 0,
            }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
          </div>

          {/* Theme picker */}
          <div
            className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ padding: '4px 14px 12px' }}
          >
            {SHARE_DESIGNS.map((d) => (
              <ThemeCard
                key={d}
                design={d}
                accent={accent}
                theme={theme}
                selected={selectedDesign === d}
                accentHex={accentHex}
                onClick={() => selectDesign(d)}
                gpsRoute={activity.route}
              />
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />

          {/* Toggle: Activity Stats */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>
              {t.activity.shareCard.statsToggle}
            </span>
            <Toggle on={showStats} onChange={setShowStats} accentHex={accentHex} />
          </div>

          {/* Toggle: Show Map Route - only for map and memory designs */}
          {(isMap || isMemory) && (
            <div className="flex items-center justify-between px-4 py-3.5">
              <span style={{ fontSize: 14, fontWeight: 500, color: canRoute ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.32)' }}>
                {t.activity.shareCard.mapRouteToggle}
              </span>
              <Toggle on={showMap} onChange={setShowMap} accentHex={accentHex} disabled={!canRoute} />
            </div>
          )}

          {/* Memory: pick photo row */}
          {isMemory && (
            <div className="flex items-center justify-between px-4 py-3.5">
              <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>
                {t.activity.shareCard.galleryPlaceholder}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 12, fontWeight: 600, color: accentHex,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                }}
              >
                {photoUrl ? 'Change' : 'Browse...'}
              </button>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />
        </div>

        {/* Action row */}
        <div
          className="grid shrink-0 gap-2.5"
          style={{
            gridTemplateColumns: canShareFiles ? '1fr 1fr 1fr' : canCopyImage ? '1fr 1fr' : '1fr',
            padding: '12px 16px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={handleSave}
            style={{
              height: 46, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Download size={15} />
            {t.activity.shareMenu.download}
          </button>

          {canShareFiles && (
            <button
              onClick={handleShare}
              style={{
                height: 46, borderRadius: 14, border: 'none',
                background: accentHex, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}
            >
              <Share2 size={15} />
              {t.activity.shareMenu.share}
            </button>
          )}

          {canCopyImage && (
            <button
              onClick={handleCopy}
              style={{
                height: 46, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.09)',
                color: copyState === 'copied' ? accentHex : 'rgba(255,255,255,0.88)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                transition: 'color 0.2s',
              }}
            >
              {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
              {copyState === 'copied' ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>
    </div>,
    document.body
  )
}
