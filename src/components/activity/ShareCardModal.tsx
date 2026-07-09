'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { renderShareCard, loadImage, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { shareCardFile, saveCardPng, copyCardPng } from '@/lib/shareCardExport'
import { useShareCardPrefs } from '@/lib/useShareCardPrefs'
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

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Body scroll lock
  useScrollLock()

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

  const handleSave = () => saveCardPng(activity, selectedDesign, renderOptions())
  const handleShare = () =>
    canShareFiles
      ? shareCardFile(activity, selectedDesign, renderOptions(),
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

  const isMemory = selectedDesign === 'memory'

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
          maxHeight: 'calc(100dvh - max(env(safe-area-inset-top), 24px) - 24px)',
          borderRadius: '28px 28px 0 0',
          background: 'var(--glass-bg-sheet)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderTop: '1px solid var(--glass-border)',
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
          className="absolute right-4 top-4 z-10"
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--ro-text) 10%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ro-text-2)', border: 'none', cursor: 'pointer',
          }}
        >
          <X size={17} strokeWidth={2.5} />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
            <div style={{
              borderRadius: 14, overflow: 'hidden', width: 132, height: 285,
              boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
              flexShrink: 0,
            }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
          </div>

          <ShareThemePicker
            selectedDesign={selectedDesign}
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
