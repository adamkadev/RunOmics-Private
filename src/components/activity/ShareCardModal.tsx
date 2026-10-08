'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { X } from 'lucide-react'
import type { ShareActivity } from '@/lib/shareCardStats'
import { renderShareCard, loadImage, pageFonts, SHARE_DESIGNS, W, MIDDLE_H, type RenderOptions, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { shareCardFile, saveCardPng, copyCardPng } from '@/lib/shareCardExport'
import { useShareCardPrefs } from '@/lib/useShareCardPrefs'
import { useShareCardMap } from '@/lib/useShareCardMap'
import { useShareCardGeocode } from '@/lib/useShareCardGeocode'
import { useAccent } from '@/lib/useAccent'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { ShareCardActions } from '@/components/activity/ShareCardActions'
import { Toggle } from '@/components/ui/Toggle'

interface Props {
  activity: ShareActivity
  /** The current VO₂max grade, for the optional badge; null hides the option. */
  vo2Grade?: string | null
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

/** The preview: the 390 x 693 card at 242 x 430, large enough to read. */
const PREVIEW_W = 242
const PREVIEW_H = 430
const SWIPE_PX = 40

/**
 * The quiet segmented recipe of every other choice in the app (ui/
 * SegmentedTabs, as Settings' theme draws it): an inset track with a line,
 * the pick lifted onto the card surface in text ink. The design picker wore
 * a filled accent pill (design review, Oct 2026); the accent is the Share
 * button's. Both pickers stay radiogroups: a choice, not a tab.
 */
const SEGMENTED_TRACK = 'gap-0.5 rounded-[11px] border border-border bg-[var(--segmented-track)] p-[3px]'

function segmentClass(selected: boolean): string {
  return cn(
    'hit-44 flex items-center justify-center whitespace-nowrap rounded-lg transition-colors',
    selected
      ? 'bg-[var(--segmented-pill)] font-semibold text-foreground shadow-[var(--segmented-pill-shadow)]'
      : 'font-medium text-muted-foreground hover:text-foreground',
  )
}

export function ShareCardModal({ activity, vo2Grade = null, canShareFiles, canCopyImage, onClose }: Props) {
  const { resolvedTheme } = useTheme()
  const appTheme: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'
  const accent = useAccent()
  const hasRoute = (activity.route?.length ?? 0) > 1
  const designs = hasRoute ? SHARE_DESIGNS : SHARE_DESIGNS.filter((d) => d !== 'route')

  const { design: chosen, setDesign, theme, setTheme } = useShareCardPrefs(appTheme, hasRoute)
  const design: ShareDesign = designs.includes(chosen) ? chosen : 'stats'
  const { locationName } = useShareCardGeocode(activity)
  // Drawn as soon as the sheet opens, so a swipe to Route finds it ready.
  const { image: mapImage, points: mapPoints } = useShareCardMap({
    route: activity.route,
    theme,
    width: W,
    height: MIDDLE_H,
    enabled: hasRoute,
  })

  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  // Off by default (v5.3): the badge is the athlete's to add.
  const [showGrade, setShowGrade] = useState(false)
  const [fontsReady, setFontsReady] = useState(0)

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
    document.fonts?.ready.then(() => { if (alive) setFontsReady((n) => n + 1) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const renderOptions = useCallback((): RenderOptions => ({
    activity,
    design,
    accent,
    theme,
    photoImage,
    locationName,
    gradeBadge: showGrade && vo2Grade ? t.vo2Grade.badge(vo2Grade) : null,
    mapImage,
    mapPoints,
    fonts: pageFonts(),
  }), [activity, design, accent, theme, photoImage, locationName, showGrade, vo2Grade, mapImage, mapPoints])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    renderShareCard(canvas, renderOptions(), dpr)
  }, [renderOptions, fontsReady])

  function selectDesign(d: ShareDesign) {
    setDesign(d)
    if (d === 'photo' && !photoImage) fileInputRef.current?.click()
  }

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

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      onClick={close}
    >
      <div
        ref={trapRef}
        data-testid="share-sheet"
        className="relative flex h-full w-full max-w-md animate-sheet-up flex-col overflow-hidden sm:max-h-[880px] sm:rounded-2xl"
        style={{ ...sheetStyle, background: 'var(--background)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center" {...handleProps} style={{ ...handleProps.style, padding: '6px 0 4px' }}>
          <span aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--band)' }} />
        </div>

        <div className="flex shrink-0 items-center justify-between" style={{ padding: '6px 20px 14px' }}>
          <h2 className="font-display text-foreground" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{s.title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={s.close}
            className="hit-44 flex items-center justify-center text-muted-foreground"
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--muted)' }}
          >
            <X size={17} strokeWidth={2.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* 2 px of room so the scroller doesn't clip the preview's outline. */}
          <div className="flex flex-col items-center" style={{ gap: 12, paddingTop: 2 }}>
            <div
              data-testid="share-preview"
              style={{
                width: PREVIEW_W, height: PREVIEW_H, borderRadius: 16, overflow: 'hidden', flexShrink: 0,
                boxShadow: '0 0 0 1px var(--border)', touchAction: 'pan-y',
              }}
              onPointerDown={(e) => { swipeX.current = e.clientX }}
              onPointerUp={(e) => {
                const from = swipeX.current
                swipeX.current = null
                if (from === null) return
                const dx = e.clientX - from
                if (Math.abs(dx) >= SWIPE_PX) step(dx < 0 ? 1 : -1)
                else if (design === 'photo') fileInputRef.current?.click()
              }}
              onPointerCancel={() => { swipeX.current = null }}
            >
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
            <div className="flex items-center" style={{ gap: 6 }} aria-hidden="true">
              {designs.map((d) => (
                <span
                  key={d}
                  style={{
                    width: d === design ? 16 : 6, height: 6, borderRadius: 3,
                    background: d === design ? 'var(--foreground)' : 'var(--band)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col" style={{ padding: '14px 20px 28px', gap: 12 }}>
            <div
              role="radiogroup"
              aria-label={s.designTitle}
              className={cn('grid', SEGMENTED_TRACK)}
              style={{ gridTemplateColumns: `repeat(${designs.length}, minmax(0, 1fr))` }}
            >
              {designs.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={d === design}
                  onClick={() => selectDesign(d)}
                  className={cn(segmentClass(d === design), 'h-9 text-sm')}
                >
                  {s.designLabels[d]}
                </button>
              ))}
            </div>

            {/* Right under the picker (v5.5 #12): last in the list, it sat
                behind the action buttons on a phone. */}
            {design === 'photo' && (
              <div className="flex items-center justify-between" style={{ padding: '2px' }}>
                <span className="text-foreground" style={{ fontSize: 15, fontWeight: 600 }}>{s.photo}</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="hit-44 text-foreground"
                  style={{ fontSize: 14, fontWeight: 600, padding: '6px 2px' }}
                >
                  {photoImage ? s.changePhoto : s.choosePhoto}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between" style={{ padding: '2px' }}>
              <span className="text-foreground" style={{ fontSize: 15, fontWeight: 600 }}>{s.background}</span>
              <div role="radiogroup" aria-label={s.background} className={cn('flex shrink-0', SEGMENTED_TRACK)}>
                {(['dark', 'light'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={theme === mode}
                    onClick={() => setTheme(mode)}
                    className={cn(segmentClass(theme === mode), 'h-[30px] px-3.5 text-[13px]')}
                  >
                    {s.themeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>

            {/* The app's one switch (ui/Toggle), off in line-2 as in Settings.
                The sheet's own drew off as --muted on its --background, two
                near-equal greys: no track to see (design review, Oct 2026). */}
            {vo2Grade && (
              <div className="flex items-center justify-between" style={{ padding: '2px' }}>
                <span className="text-foreground" style={{ fontSize: 15, fontWeight: 600 }}>{t.vo2Grade.shareBadge}</span>
                <Toggle checked={showGrade} onChange={setShowGrade} label={t.vo2Grade.shareBadge} />
              </div>
            )}

          </div>
        </div>

        <ShareCardActions
          canShareFiles={canShareFiles}
          canCopyImage={canCopyImage}
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
