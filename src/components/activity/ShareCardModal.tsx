'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { Camera, X } from 'lucide-react'
import type { ShareActivity } from '@/lib/shareCardStats'
import {
  renderShareCard, loadImage, pageFonts, shareCardMapFrame, SHARE_DESIGNS, W, H,
  type RenderOptions, type ShareDesign, type ThemeMode,
} from '@/lib/shareCard'
import { shareCardFile, saveCardPng, copyCardPng } from '@/lib/shareCardExport'
import { useShareCardPrefs } from '@/lib/useShareCardPrefs'
import { useShareCardMap } from '@/lib/useShareCardMap'
import { useShareCardGeocode } from '@/lib/useShareCardGeocode'
import { useAccent } from '@/lib/useAccent'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { SEGMENTED_IDLE_CLASS, SEGMENTED_THUMB_CLASS, SEGMENTED_TRACK_CLASS } from '@/components/ui/SegmentedTabs'
import { t } from '@/i18n'
import { ShareCardActions } from '@/components/activity/ShareCardActions'

interface Props {
  activity: ShareActivity
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

/**
 * The card box (design review, Oct 2026): one 4:5 box on every tab, so the
 * controls under it never move - 300 x 375, or narrower on a small phone,
 * the sheet's 20 px margins and 14 px more on each side.
 */
const CARD_BOX_W = `min(${W}px, calc(100vw - 68px))`
const SWIPE_PX = 40

/**
 * The quiet segmented recipe of every other choice in the app (ui/
 * SegmentedTabs, as Settings' theme draws it): an inset track with a line,
 * the pick lifted onto the card surface in text ink. The design picker wore
 * a filled accent pill (design review, Oct 2026); the accent is the Share
 * button's. Both pickers stay radiogroups: a choice, not a tab.
 */
const SEGMENTED_TRACK = SEGMENTED_TRACK_CLASS

function segmentClass(selected: boolean): string {
  return cn(
    'hit-44 flex items-center justify-center whitespace-nowrap transition-colors',
    selected ? SEGMENTED_THUMB_CLASS : SEGMENTED_IDLE_CLASS,
  )
}

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const { resolvedTheme } = useTheme()
  const appTheme: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'
  const accent = useAccent()
  const hasRoute = (activity.route?.length ?? 0) > 1
  const designs = hasRoute ? SHARE_DESIGNS : SHARE_DESIGNS.filter((d) => d !== 'route')

  const { design: chosen, setDesign, theme, setTheme } = useShareCardPrefs(appTheme, hasRoute)
  const design: ShareDesign = designs.includes(chosen) ? chosen : 'stats'
  const { locationName } = useShareCardGeocode(activity)
  const [fontsReady, setFontsReady] = useState(0)
  // The map fills the card, the route fitted between the header and the
  // stats, whose height the title's lines set: measured again once Geist
  // has loaded, as the card will be drawn in it.
  const [mapFrame, setMapFrame] = useState(() => shareCardMapFrame(activity, pageFonts()))
  // Drawn as soon as the sheet opens, so a swipe to Route finds it ready.
  const { image: mapImage, points: mapPoints, labels: mapLabels } = useShareCardMap({
    route: activity.route,
    theme,
    width: W,
    height: H,
    frame: mapFrame.frame,
    bands: mapFrame.bands,
    enabled: hasRoute,
  })

  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  // Photo with none chosen yet: the frame is the picker, and there is nothing to share.
  const awaitingPhoto = design === 'photo' && !photoImage

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const swipeX = useRef<number | null>(null)
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

  // A canvas draws in whatever font has loaded; draw again once Geist has.
  useEffect(() => {
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive) return
      setFontsReady((n) => n + 1)
      setMapFrame(shareCardMapFrame(activity, pageFonts()))
    }).catch(() => {})
    return () => { alive = false }
  }, [activity])

  const renderOptions = useCallback((): RenderOptions => ({
    activity,
    design,
    accent,
    theme,
    photoImage,
    locationName,
    mapImage,
    mapPoints,
    mapLabels,
    fonts: pageFonts(),
  }), [activity, design, accent, theme, photoImage, locationName, mapImage, mapPoints, mapLabels])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Sharp at the box's own width, whatever the phone makes of 300 px.
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const shown = canvas.parentElement?.clientWidth || W
    renderShareCard(canvas, renderOptions(), (shown / W) * dpr)
  }, [renderOptions, fontsReady])

  function step(by: number) {
    const i = designs.indexOf(design)
    const next = designs[Math.min(Math.max(i + by, 0), designs.length - 1)]
    if (next && next !== design) setDesign(next)
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
        setPhotoImage(img)
      })
      .catch(() => URL.revokeObjectURL(url))
  }

  const handleSave = () => saveCardPng(activity, design, renderOptions())
  const handleShare = () =>
    shareCardFile(activity, design, renderOptions(),
      `${activity.description || t.activity.metaFallbackTitle} - RunOmics`)
  const handleCopy = () => {
    copyCardPng(renderOptions())
      .then(() => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 1500)
      })
      .catch(console.error)
  }

  const s = t.activity.shareCard

  const chip = {
    height: 44, padding: '0 16px', borderRadius: 9999, fontSize: 15, fontWeight: 600,
    background: 'var(--fill-3)',
  } as const

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end justify-center bg-[var(--scrim-sheet)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      onClick={close}
    >
      {/* A sheet as tall as what it holds (design review, Oct 2026): handle,
          title, card, tabs, one option row, the buttons - no spacer, the
          run still showing above it. It scrolls only on a phone too short.
          Liquid Glass v3's large detent (G10): full width, opaque on the
          raised surface, top corners 38 pt - no glass under a photo card. */}
      <div
        ref={trapRef}
        data-testid="share-sheet"
        className="relative flex max-h-full w-full max-w-md animate-[sheet-rise_520ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col overflow-y-auto overscroll-contain rounded-t-[var(--radius-sheet-large)] [scrollbar-width:none] sm:rounded-[var(--radius-sheet-large)] [&::-webkit-scrollbar]:hidden"
        style={{
          ...sheetStyle,
          background: 'var(--raised)',
          boxShadow: 'var(--shadow-modal)',
          padding: '6px 22px 0',
          paddingBottom: 'max(26px, var(--safe-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center" {...handleProps} style={{ ...handleProps.style }}>
          <span aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 2.5, background: 'rgb(127 127 127 / 0.45)' }} />
        </div>

        {/* The sheet header (G10): close as a filled circle, the title centred. */}
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center" style={{ marginTop: 10, height: 44 }}>
          <button
            type="button"
            onClick={close}
            aria-label={s.close}
            className="flex size-11 items-center justify-center justify-self-start rounded-full bg-[var(--fill-3)] text-foreground"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
          <h2 className="text-headline text-foreground">{s.title}</h2>
          <span />
        </div>

        <div
          data-testid="share-preview"
          className="relative shrink-0 self-center overflow-hidden"
          style={{
            width: CARD_BOX_W, aspectRatio: '4 / 5', marginTop: 14, borderRadius: 24, touchAction: 'pan-y',
            boxShadow: awaitingPhoto ? 'none' : '0 0 0 1px var(--border)',
          }}
          onPointerDown={(e) => { swipeX.current = e.clientX }}
          onPointerUp={(e) => {
            const from = swipeX.current
            swipeX.current = null
            if (from === null) return
            const dx = e.clientX - from
            if (Math.abs(dx) >= SWIPE_PX) step(dx < 0 ? 1 : -1)
            else if (design === 'photo' && photoImage) fileInputRef.current?.click()
          }}
          onPointerCancel={() => { swipeX.current = null }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: awaitingPhoto ? 'none' : 'block' }} />
          {/* The empty frame is the picker, and the exact crop the photo gets. */}
          {awaitingPhoto && (
            <button
              type="button"
              data-testid="share-photo-picker"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"
              style={{ gap: 10, borderRadius: 24, border: '1.5px dashed var(--muted-foreground)', background: 'var(--background)' }}
            >
              <Camera size={34} strokeWidth={1.8} className="text-foreground" aria-hidden="true" />
              <span className="text-foreground" style={{ fontSize: 15, fontWeight: 600 }}>{s.choosePhoto}</span>
              <span style={{ fontSize: 11 }}>{s.photoHint}</span>
            </button>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={s.designTitle}
          className={cn('grid shrink-0', SEGMENTED_TRACK)}
          style={{ gridTemplateColumns: `repeat(${designs.length}, minmax(0, 1fr))`, marginTop: 14 }}
        >
          {designs.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === design}
              onClick={() => setDesign(d)}
              className={cn(segmentClass(d === design), 'h-[34px] text-[15px]')}
            >
              {s.designLabels[d]}
            </button>
          ))}
        </div>

        {/* One option row, at one height on every tab: the background, or -
            a photo covers the whole card - the photo itself. */}
        <div data-testid="share-options" className="flex shrink-0 items-center justify-between" style={{ minHeight: 52, marginTop: 4 }}>
          {design === 'photo' ? (
            <>
              <span className="text-foreground" style={{ fontSize: 17 }}>{s.photo}</span>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center text-foreground" style={chip}>
                {photoImage ? s.replacePhoto : s.choosePhoto}
              </button>
            </>
          ) : (
            <>
              <span className="text-foreground" style={{ fontSize: 17 }}>{s.background}</span>
              <div role="radiogroup" aria-label={s.background} className={cn('flex shrink-0', SEGMENTED_TRACK)}>
                {(['dark', 'light'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={theme === mode}
                    onClick={() => setTheme(mode)}
                    className={cn(segmentClass(theme === mode), 'h-[26px] px-3.5 text-[13px]')}
                  >
                    {s.themeLabels[mode]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <ShareCardActions
          canShareFiles={canShareFiles}
          canCopyImage={canCopyImage}
          copyState={copyState}
          disabled={awaitingPhoto}
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
