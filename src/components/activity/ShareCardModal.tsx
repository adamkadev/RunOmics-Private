'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { renderShareCard, loadImage, W, H, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { shareCardFile, saveCardPng, copyCardPng } from '@/lib/shareCardExport'
import { useShareCardPrefs } from '@/lib/useShareCardPrefs'
import { useShareCardMap } from '@/lib/useShareCardMap'
import { useShareCardGeocode } from '@/lib/useShareCardGeocode'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { t } from '@/i18n'
import { ShareThemePicker } from '@/components/activity/ShareThemePicker'
import { ShareAccentPicker } from '@/components/activity/ShareAccentPicker'
import { ShareCardActions } from '@/components/activity/ShareCardActions'
import { Toggle, RowDivider, SettingRow } from '@/components/activity/ShareCardControls'

interface Props {
  activity: Activity
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const { resolvedTheme } = useTheme()
  const appTheme: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'

  const {
    selectedDesign, setSelectedDesign,
    shareAccent, setShareAccent,
    customHex, setCustomHex,
    lightMode, setLightMode,
    effectiveAccent, customAccentHex, customRgb, shareAccentHex, shareTheme,
  } = useShareCardPrefs(appTheme)
  const { locationName, streetLabels } = useShareCardGeocode(activity)

  // The route design needs a real trace; without one its thumbnail is hidden,
  // so a design remembered from another activity falls back for this render
  // only - the stored preference is left alone.
  const hasRoute = (activity.route?.length ?? 0) > 1
  const design: ShareDesign = selectedDesign === 'route' && !hasRoute ? 'aurora' : selectedDesign
  const { image: mapImage, points: mapPoints, failed: mapFailed } = useShareCardMap({
    route: activity.route,
    theme: shareTheme,
    width: W,
    height: H,
    enabled: design === 'route',
  })

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useScrollLock()

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
  }, [])

  const renderOptions = useCallback(() => ({
    activity,
    design,
    accent: effectiveAccent,
    customAccentHex,
    theme: shareTheme,
    showStats: true,
    showMap: design === 'map',
    photoImage,
    gpsRoute: activity.route,
    locationName,
    streetLabels,
    mapImage,
    mapPoints,
    mapFailed,
  }), [activity, design, effectiveAccent, customAccentHex, shareTheme, photoImage, locationName, streetLabels, mapImage, mapPoints, mapFailed])

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

  const handleSave = () => saveCardPng(activity, design, renderOptions())
  const handleShare = () =>
    canShareFiles
      ? shareCardFile(activity, design, renderOptions(),
          `${activity.description || t.activity.metaFallbackTitle} - RunOmics`)
      : handleSave()
  const handleCopy = () => {
    copyCardPng(renderOptions())
      .then(() => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 1500)
      })
      .catch(console.error)
  }

  const isMemory = design === 'memory'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        ref={trapRef}
        className="relative flex w-full max-w-md animate-sheet-up flex-col overflow-hidden sm:rounded-2xl"
        style={{
          ...sheetStyle,
          // Full-height sheet: the glass background spans the entire screen
          // (including behind the notch / Dynamic Island) so there's no dark
          // strip above the drag handle. `paddingTop` keeps the handle and the
          // close button clear of the top safe-area inset, so the content still
          // starts just below the notch even though the fill reaches the top.
          height: '100dvh',
          maxHeight: '100dvh',
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          borderRadius: '0',
          background: 'var(--glass-bg-sheet)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden" {...handleProps}>
          <span
            className="rounded-full"
            aria-hidden="true"
            style={{ width: 36, height: 4, background: 'color-mix(in srgb, var(--ro-text) 25%, transparent)' }}
          />
        </div>

        {/* Close button floats over the scrollable body instead of owning its own row */}
        <button
          onClick={close}
          aria-label={t.activity.shareCard.close}
          className="absolute right-4 z-10"
          style={{
            // Offset below the top safe-area inset by hand: an absolutely
            // positioned element is placed against the sheet's padding box, so
            // the sheet's paddingTop doesn't push it down like it does the
            // handle - without this it would sit behind the notch.
            top: 'calc(max(env(safe-area-inset-top), 12px) + 6px)',
            width: 34, height: 34, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--ro-text) 10%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ro-text-2)', border: 'none', cursor: 'pointer',
          }}
        >
          <X size={17} strokeWidth={2.5} />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
            <div style={{
              // 9:16, matching the exported story's aspect ratio.
              borderRadius: 18, overflow: 'hidden', width: 176, height: 313,
              boxShadow: 'var(--shadow-modal)',
              flexShrink: 0,
            }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
          </div>

          <ShareThemePicker
            selectedDesign={design}
            accent={effectiveAccent}
            theme={shareTheme}
            accentHex={shareAccentHex}
            customRgb={customRgb}
            gpsRoute={activity.route}
            photoUrl={photoUrl}
            onSelect={selectDesign}
          />

          <RowDivider />

          <SettingRow title={t.activity.shareCard.accentTitle} subtitle={t.activity.shareCard.accentSubtitle}>
            <ShareAccentPicker
              shareAccent={shareAccent}
              customHex={customHex}
              onSelectAccent={setShareAccent}
              onSelectCustom={(hex) => { setShareAccent('custom'); setCustomHex(hex) }}
            />
          </SettingRow>

          <RowDivider />

          <SettingRow title={t.activity.shareCard.lightModeToggle} subtitle={t.activity.shareCard.lightModeSubtitle}>
            <Toggle on={lightMode} onChange={setLightMode} accentHex={shareAccentHex} />
          </SettingRow>

          {isMemory && (
            <>
              <RowDivider />
              <SettingRow title={t.activity.shareCard.galleryPlaceholder}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: 12, fontWeight: 600, color: shareAccentHex,
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                  }}
                >
                  {photoUrl ? t.activity.shareCard.changePhoto : t.activity.shareCard.browsePhoto}
                </button>
              </SettingRow>
            </>
          )}

          <RowDivider />
        </div>

        <ShareCardActions
          canShareFiles={canShareFiles}
          canCopyImage={canCopyImage}
          accentHex={shareAccentHex}
          copyState={copyState}
          onShare={handleShare}
          onSave={handleSave}
          onCopy={handleCopy}
        />

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
