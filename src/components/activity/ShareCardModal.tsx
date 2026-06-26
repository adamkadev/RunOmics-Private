'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { Check, Copy, Download, Share2, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import {
  H as CARD_H,
  loadImage,
  renderShareCard,
  SHARE_DESIGNS,
  shareCardFileName,
  W as CARD_W,
  type MapStyle,
  type ShareDesign,
} from '@/lib/shareCard'
import { captureRouteMapSnapshot } from '@/lib/routeMapSnapshot'
import { ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'
import { useDragToDismiss } from '@/hooks/useDragToDismiss'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'
import { Button } from '@/components/ui/Button'
import { ACCENT_TOKENS, getDesignConfig } from '@/components/activity/shareCardDesignTokens'
import { DesignThumb } from '@/components/activity/ShareCardThumbnails'
import { DesignPreview, PREVIEW_HEIGHT, PREVIEW_WIDTH } from '@/components/activity/ShareCardDesignPreview'
import { t } from '@/i18n'

const MAP_STYLES: MapStyle[] = ['light', 'dark']

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

interface Props {
  activity: Activity
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const { resolvedTheme } = useTheme()
  const [design, setDesign] = useState<ShareDesign>('aurora')
  const [showMap, setShowMap] = useState(true)
  const [mapStyle, setMapStyle] = useState<MapStyle>(resolvedTheme === 'light' ? 'light' : 'dark')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  // Resolved map snapshots, cached per style so switching light/dark doesn't re-fetch.
  const [mapSnapshots, setMapSnapshots] = useState<Partial<Record<MapStyle, { url: string; img: HTMLImageElement }>>>({})

  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)

  const [previewScale, setPreviewScale] = useState(1)
  useEffect(() => {
    function update() { setPreviewScale(Math.min(1, (window.innerWidth - 40) / PREVIEW_WIDTH)) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const [accent] = useState<AccentId>(currentAccent)
  const accentHex = ACCENT_SWATCHES[accent]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)

  const isMapBg = design === 'map'
  const effectiveShowMap = showMap || isMapBg
  const canCaptureMap = !!activity.route && activity.route.length > 1 && !!process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  const mapSnapshot = mapSnapshots[mapStyle] ?? null
  const mapLoading = isMapBg && canCaptureMap && !mapSnapshot

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderShareCard(canvas, {
      activity,
      design,
      accent,
      showMap: effectiveShowMap,
      photoImage,
      mapImage: mapSnapshot?.img ?? null,
      mapStyle,
    })
  }, [activity, accent, design, effectiveShowMap, photoImage, mapSnapshot, mapStyle])

  useEffect(() => { redraw() }, [redraw])

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    const { style } = document.documentElement
    const prev = style.overflow
    style.overflow = 'hidden'
    return () => { style.overflow = prev }
  }, [])

  // Captures the route-on-map background for the selected style, the first time it's needed.
  // Resolved snapshots are cached per style in state, so switching light/dark back and forth
  // doesn't re-fetch.
  useEffect(() => {
    if (!isMapBg || mapSnapshots[mapStyle]) return
    const route = activity.route
    if (!route || route.length < 2) return
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
    if (!token) { console.warn('NEXT_PUBLIC_MAPTILER_TOKEN not set'); return }

    let cancelled = false
    // light basemap: the route's white halo (drawn in captureRouteMapSnapshot) needs a
    // saturated line on top of it, not white, or it disappears against the light tiles.
    const routeColor = mapStyle === 'light' ? ACCENT_TOKENS[accent].accentLight : getDesignConfig('map', accent).routeColor
    captureRouteMapSnapshot({
      route,
      color: routeColor,
      isDark: mapStyle === 'dark',
      token,
      width: CARD_W,
      height: CARD_H,
    })
      .then((url) => loadImage(url).then((img) => ({ url, img })))
      .then((result) => {
        if (cancelled) return
        setMapSnapshots((prev) => ({ ...prev, [mapStyle]: result }))
      })
      .catch((err) => console.error(err))

    return () => { cancelled = true }
  }, [isMapBg, activity.route, accent, mapStyle, mapSnapshots])

  function selectDesign(d: ShareDesign) {
    setDesign(d)
    // Memory's photo is the focal point - don't clutter it with the route trace by default.
    setShowMap(d !== 'memory')
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
      onClick={close}
    >
      <div
        className="glass-sheet relative flex max-h-[92vh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-3xl sm:h-auto sm:max-h-[92vh] sm:max-w-md sm:rounded-2xl"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) - drag down to dismiss */}
        <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden" {...handleProps}>
          <span className="h-[5px] w-9 rounded-full bg-foreground/25" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-body font-semibold tracking-tight text-foreground">{t.activity.share}</h2>
          <button
            onClick={close}
            aria-label={t.activity.shareCard.close}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.09] text-muted-foreground transition-colors hover:bg-foreground/[0.14]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Preview card (interactive HTML preview, scaled up to fill the taller sheet) */}
          <div className="flex justify-center px-5 pb-4">
            <div style={{ width: PREVIEW_WIDTH * previewScale, height: PREVIEW_HEIGHT * previewScale }}>
              <div style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <DesignPreview
                  activity={activity}
                  design={design}
                  accent={accent}
                  showMap={showMap}
                  photoUrl={photoUrl}
                  onPickPhoto={() => fileInputRef.current?.click()}
                  mapSnapshotUrl={mapSnapshot?.url}
                  mapLoading={mapLoading}
                  mapStyle={mapStyle}
                />
              </div>
            </div>
          </div>

          {/* Hidden canvas for export */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Design picker */}
          <div className="border-t border-foreground/[0.07] px-5 py-3">
            <div className="mb-2.5 text-caption font-semibold uppercase tracking-wide text-foreground/40">
              {t.activity.shareCard.designLabel}
            </div>
            <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SHARE_DESIGNS.map((d) => (
                <DesignThumb
                  key={d}
                  design={d}
                  selected={design === d}
                  accentHex={accentHex}
                  onClick={() => selectDesign(d)}
                />
              ))}
            </div>
          </div>

          {/* Map toggle - hidden for the Map design (the map is always the background there) */}
          {!isMapBg && (
            <div className="flex items-center justify-between border-t border-foreground/[0.07] px-5 py-3">
              <div>
                <div className="text-subhead text-foreground">{t.activity.shareCard.mapToggle}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowMap((m) => !m)}
                aria-pressed={showMap}
                className="relative ml-4 h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
                style={{ background: showMap ? accentHex : 'rgba(120,120,128,0.22)' }}
              >
                <span
                  className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.28)] transition-[left] duration-200"
                  style={{ left: showMap ? 22 : 2 }}
                />
              </button>
            </div>
          )}
          {/* Map style (light/dark basemap), Map design only */}
          {isMapBg && (
            <div className="flex items-center justify-between border-t border-foreground/[0.07] px-5 py-3">
              <div className="text-subhead text-foreground">{t.activity.shareCard.mapStyleLabel}</div>
              <div className="flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
                {MAP_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setMapStyle(style)}
                    className={cn(
                      'rounded-full px-3.5 py-2.5 text-xs font-semibold transition-colors',
                      mapStyle === style ? 'bg-foreground/[0.14] text-foreground' : 'text-foreground/55'
                    )}
                  >
                    {style === 'light' ? t.activity.shareCard.mapStyleLight : t.activity.shareCard.mapStyleDark}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 gap-2 border-t border-foreground/[0.07] p-3">
          {canShareFiles ? (
            <Button onClick={handleShare} className="h-11 flex-[1.5] text-footnote">
              <Share2 size={16} />
              {t.activity.shareMenu.share}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={handleSave} className="h-11 flex-1 text-footnote">
            <Download size={16} />
            {t.activity.shareMenu.download}
          </Button>
          {canCopyImage && (
            <Button
              variant="secondary"
              onClick={handleCopy}
              className={cn('h-11 flex-1 text-footnote', copyState === 'copied' && STATUS.success.text)}
            >
              {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
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