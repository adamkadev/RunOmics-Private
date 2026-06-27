'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { Check, Copy, Download, Share2, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { SHARE_DESIGNS, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { renderShareCard, shareCardFileName, loadImage, hexToRgb } from '@/lib/shareCard'
import { ACCENT_SWATCHES, ACCENT_IDS, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'
import { useDragToDismiss } from '@/hooks/useDragToDismiss'
import { t } from '@/i18n'
import { ThemeCard, ThemeDivider } from '@/components/activity/ShareCardThumbnails'

type ShareAccent = AccentId | 'custom'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    })
  })
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
  const appTheme: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'

  const [selectedDesign, setSelectedDesign] = useState<ShareDesign>(() => {
    const stored = readLocalStorage('ro_shareTheme', 'aurora')
    return (SHARE_DESIGNS as string[]).includes(stored) ? stored as ShareDesign : 'aurora'
  })

  const [shareAccent, setShareAccent] = useState<ShareAccent>(() => {
    const stored = readLocalStorage('ro_shareAccent', DEFAULT_ACCENT)
    if (stored === 'custom') return 'custom'
    return isAccentId(stored) ? stored : DEFAULT_ACCENT
  })
  const [customHex, setCustomHex] = useState<string>(() =>
    readLocalStorage('ro_shareCustomHex', '#10b981')
  )
  const [lightMode, setLightMode] = useState<boolean>(() =>
    readLocalStorage('ro_shareLightMode', 'false') === 'true'
  )

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [locationName, setLocationName] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`ro_geocode_${activity.id}`) } catch { return null }
  })
  const [streetLabels, setStreetLabels] = useState<string[]>(() => {
    try {
      const cached = sessionStorage.getItem(`ro_geocode_${activity.id}_roads`)
      return cached ? (JSON.parse(cached) as string[]) : []
    } catch { return [] }
  })

  const effectiveAccent: AccentId = shareAccent === 'custom' ? 'nature' : shareAccent
  const customAccentHex: string | undefined = shareAccent === 'custom' ? customHex : undefined
  const customRgb: [number, number, number] | undefined = shareAccent === 'custom' ? hexToRgb(customHex) : undefined
  const shareAccentHex = shareAccent === 'custom' ? customHex : ACCENT_SWATCHES[shareAccent]
  const shareTheme: ThemeMode = lightMode ? 'light' : appTheme

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)

  // Persist preferences
  useEffect(() => { try { localStorage.setItem('ro_shareTheme', selectedDesign) } catch { /* noop */ } }, [selectedDesign])
  useEffect(() => { try { localStorage.setItem('ro_shareAccent', shareAccent) } catch { /* noop */ } }, [shareAccent])
  useEffect(() => { try { localStorage.setItem('ro_shareCustomHex', customHex) } catch { /* noop */ } }, [customHex])
  useEffect(() => { try { localStorage.setItem('ro_shareLightMode', String(lightMode)) } catch { /* noop */ } }, [lightMode])

  // Reverse geocoding (cache in sessionStorage)
  useEffect(() => {
    if (locationName !== null && streetLabels.length > 0) return
    if (!activity.route || activity.route.length < 1) return
    const route = activity.route
    const cacheKey = `ro_geocode_${activity.id}`
    const indices = [...new Set([0, Math.floor(route.length * 0.5), route.length - 1])]
    Promise.allSettled(
      indices.map(idx => {
        const [lng, lat] = route[idx]
        return fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
          { headers: { 'Accept-Language': 'fr', 'User-Agent': 'RunOmics/1.0' } }
        ).then(res => res.json()) as Promise<{ address?: Record<string, string> }>
      })
    ).then(results => {
      const roads: string[] = []
      let cityName: string | null = null
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        const addr = r.value.address ?? {}
        const road = addr.road ?? addr.pedestrian ?? addr.path ?? null
        if (road && !roads.includes(road)) roads.push(road)
        if (!cityName) {
          const suburb = addr.suburb ?? addr.neighbourhood
          const city = addr.city ?? addr.town ?? addr.village
          cityName = suburb ? `${suburb}, ${city}` : (city ?? null)
        }
      }
      if (roads.length > 0) {
        try { sessionStorage.setItem(`${cacheKey}_roads`, JSON.stringify(roads)) } catch { /* noop */ }
        setStreetLabels(roads)
      }
      if (cityName) {
        try { sessionStorage.setItem(cacheKey, cityName) } catch { /* noop */ }
        setLocationName(cityName)
      }
    })
  }, [activity.id, activity.route, locationName, streetLabels.length])

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
    accent: effectiveAccent,
    customAccentHex,
    theme: shareTheme,
    showStats: true,
    showMap: selectedDesign === 'map',
    photoImage,
    gpsRoute: activity.route,
    locationName,
    streetLabels,
  }), [activity, selectedDesign, effectiveAccent, customAccentHex, shareTheme, photoImage, locationName, streetLabels])

  // Redraw preview canvas whenever options change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    renderShareCard(canvas, renderOptions(), dpr)
  }, [renderOptions])

  function selectDesign(d: ShareDesign) {
    setSelectedDesign(d)
    if (d === 'memory' && !photoImage) fileInputRef.current?.click()
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
    const hiCanvas = document.createElement('canvas')
    renderShareCard(hiCanvas, renderOptions(), 3)
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': canvasToBlob(hiCanvas) })])
      .then(() => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 1500)
      })
      .catch(console.error)
  }

  const isMemory = selectedDesign === 'memory'

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
              <Fragment key={d}>
                {d === 'memory' && <ThemeDivider label={t.activity.shareCard.orUsePhoto} />}
                <ThemeCard
                  design={d}
                  accent={effectiveAccent}
                  theme={shareTheme}
                  selected={selectedDesign === d}
                  accentHex={shareAccentHex}
                  onClick={() => selectDesign(d)}
                  gpsRoute={activity.route}
                  photoUrl={d === 'memory' ? photoUrl : null}
                  customRgb={customRgb}
                />
              </Fragment>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />

          {/* Accent row */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '10px 16px' }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0faf5' }}>
                {t.activity.shareCard.accentTitle}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {t.activity.shareCard.accentSubtitle}
              </div>
            </div>
            <div className="flex items-center" style={{ gap: 5 }}>
              {ACCENT_IDS.map((id) => {
                const selected = shareAccent === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setShareAccent(id)}
                    aria-label={id}
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: ACCENT_SWATCHES[id],
                      border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                      boxShadow: selected
                        ? `0 0 0 2.5px rgba(255,255,255,0.85), 0 0 0 4.5px ${ACCENT_SWATCHES[id]}40`
                        : 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                    }}
                  />
                )
              })}
              {/* Custom color dot */}
              <label style={{ position: 'relative', width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'block', width: 18, height: 18, borderRadius: '50%',
                    background: shareAccent === 'custom'
                      ? customHex
                      : 'conic-gradient(red, #ff0, lime, cyan, blue, magenta, red)',
                    border: shareAccent === 'custom' ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                    boxShadow: shareAccent === 'custom'
                      ? `0 0 0 2.5px rgba(255,255,255,0.85), 0 0 0 4.5px ${customHex}40`
                      : 'none',
                  }}
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={customHex}
                  onChange={(e) => { setShareAccent('custom'); setCustomHex(e.target.value) }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />

          {/* Toggle: Light mode */}
          <div className="flex items-center justify-between" style={{ padding: '11px 16px' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0faf5' }}>
                {t.activity.shareCard.lightModeToggle}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {t.activity.shareCard.lightModeSubtitle}
              </div>
            </div>
            <Toggle on={lightMode} onChange={setLightMode} accentHex={shareAccentHex} />
          </div>

          {/* Memory: pick photo row */}
          {isMemory && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />
              <div className="flex items-center justify-between" style={{ padding: '11px 16px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f0faf5' }}>
                  {t.activity.shareCard.galleryPlaceholder}
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: 12, fontWeight: 600, color: shareAccentHex,
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                  }}
                >
                  {photoUrl ? 'Change' : 'Browse...'}
                </button>
              </div>
            </>
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
                background: shareAccentHex, color: '#fff',
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
                color: copyState === 'copied' ? shareAccentHex : 'rgba(255,255,255,0.88)',
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
