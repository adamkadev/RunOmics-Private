'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'
import { Camera, Loader2, X } from 'lucide-react'
import type { ShareActivity } from '@/lib/shareCardStats'
import {
  renderShareCard, loadImage, pageFonts, shareCardHeight, shareCardMapFrame, SHARE_DESIGNS, SHARE_SIZES, W,
  type RenderOptions, type ShareDesign, type ShareSize, type ThemeMode,
} from '@/lib/shareCard'
import { shareCardFile, saveCardPng, copyCardPng, shareOrSaveFile } from '@/lib/shareCardExport'
import { renderShareVideo, shareVideoEncoder, type VideoEncoderKind } from '@/lib/shareCardVideo'
import { VIDEO_SECONDS, videoFrameAt } from '@/lib/shareCardTimeline'
import { useShareCardPrefs } from '@/lib/useShareCardPrefs'
import { useShareCardMap } from '@/lib/useShareCardMap'
import { useShareCardGeocode } from '@/lib/useShareCardGeocode'
import { useAccent } from '@/lib/useAccent'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { SEGMENTED_FILL_SEGMENT_CLASS, SEGMENTED_IDLE_CLASS, SEGMENTED_THUMB_CLASS, SEGMENTED_TRACK_CLASS } from '@/components/ui/SegmentedTabs'
import { t } from '@/i18n'
import { ShareCardActions } from '@/components/activity/ShareCardActions'
import { Toggle } from '@/components/ui/Toggle'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { SHEET_CONTROL } from '@/components/ui/Sheet'

interface Props {
  activity: ShareActivity
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

/**
 * One box per size on every tab, so the controls under it never move: 88 % of the sheet's width less its margins, so the
 * first two options fit above the pinned buttons. A short window narrows it; 180 px is the floor.
 */
const PREVIEW_SCALE = 0.88
const CARD_BOX_W = `min(${W * PREVIEW_SCALE}px, calc((100vw - 68px) * ${PREVIEW_SCALE}), max(180px, calc((100dvh - 430px) * 4 / 5)))`
const STORY_BOX_W = `min(${W * PREVIEW_SCALE}px, calc((100vw - 68px) * ${PREVIEW_SCALE}), max(180px, calc((100dvh - 430px) * 9 / 16)))`
const ASPECT: Record<ShareSize, string> = { portrait: '4 / 5', story: '9 / 16' }
const SWIPE_PX = 40

/** Both pickers stay radiogroups: a choice, not a tab. */
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

  const { design: chosen, setDesign, theme, setTheme, showReps, setShowReps, showRecord, setShowRecord, photoRoute, setPhotoRoute, size, setSize } = useShareCardPrefs(appTheme, hasRoute)
  const design: ShareDesign = designs.includes(chosen) ? chosen : 'stats'
  // Without its reps the card is an easy run's: one colour on the route, the average pace back, the reps only shaded.
  const card = useMemo(() => {
    const shown = showRecord || !activity.record ? activity : { ...activity, record: null }
    return showReps || !shown.reps ? shown : { ...shown, reps: null, repWindows: shown.reps.windows }
  }, [activity, showReps, showRecord])
  const { locationName: roughPlace } = useShareCardGeocode(activity)
  const [fontsReady, setFontsReady] = useState(0)
  // Measured again once Geist has loaded: the title's lines set the stats'
  // height, and the card is drawn in Geist.
  const [mapFrame, setMapFrame] = useState(() => shareCardMapFrame(card, pageFonts(), size))
  // Drawn as soon as the sheet opens, so a swipe to Route finds it ready.
  const { image: mapImage, points: mapPoints, labels: mapLabels, place: mapPlace, failed: mapFailed } = useShareCardMap({
    route: activity.route,
    theme,
    width: W,
    height: shareCardHeight(size),
    frame: mapFrame.frame,
    bands: mapFrame.bands,
    enabled: hasRoute,
  })
  const locationName = mapPlace ?? roughPlace

  const [videoEncoder, setVideoEncoder] = useState<VideoEncoderKind | null>(null)
  const [format, setFormat] = useState<'image' | 'video'>('image')
  const [encoding, setEncoding] = useState<{ key: string; percent: number } | null>(null)
  const [videoFiles, setVideoFiles] = useState<Record<string, File>>({})
  const showFormat = design === 'route' && videoEncoder !== null
  // Each frame redraws the cached map; until it has rendered, a video would capture the plain fallback.
  const mapSettled = !!mapImage || mapFailed
  const video = showFormat && format === 'video' && mapSettled

  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const awaitingPhoto = design === 'photo' && !photoImage
  // A quick save before the map renders would post the bare line; after a failure the line alone is the card.
  const awaitingMap = design === 'route' && !mapSettled

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const swipeX = useRef<number | null>(null)
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>({ initial: 'container' })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useScrollLock()

  useEffect(() => {
    let alive = true
    shareVideoEncoder(size).then((kind) => { if (alive) setVideoEncoder(kind) }).catch(() => {})
    return () => { alive = false }
  }, [size])

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
  }, [])

  // A canvas draws in whatever font has loaded; draw again once Geist has.
  useEffect(() => {
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive) return
      setFontsReady((n) => n + 1)
      setMapFrame(shareCardMapFrame(card, pageFonts(), size))
    }).catch(() => {})
    return () => { alive = false }
  }, [card, size])

  const renderOptions = useCallback((): RenderOptions => ({
    activity: card,
    design,
    size,
    accent,
    theme,
    photoImage,
    photoRoute,
    locationName,
    mapImage,
    mapPoints,
    mapLabels,
    fonts: pageFonts(),
  }), [card, design, size, accent, theme, photoImage, photoRoute, locationName, mapImage, mapPoints, mapLabels])

  const videoKey = [card.id, size, theme, accent, showReps, showRecord, locationName ?? '', mapImage ? 'map' : 'plain', fontsReady].join('|')
  const videoReady = !!videoFiles[videoKey]

  // The key names what changes the clip; renderOptions follows the same inputs, so a change cancels and restarts.
  useEffect(() => {
    if (!video || !videoEncoder || videoReady) return
    const controller = new AbortController()
    renderShareVideo(card, renderOptions(), videoEncoder, (share) => {
      if (!controller.signal.aborted) setEncoding({ key: videoKey, percent: Math.round(share * 100) })
    }, controller.signal)
      .then((file) => {
        setVideoFiles((files) => ({ ...files, [videoKey]: file }))
        setEncoding(null)
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return
        console.error(err)
        setEncoding(null)
        setFormat('image')
      })
    return () => controller.abort()
  }, [video, videoEncoder, videoKey, videoReady, card, renderOptions])

  const preparing = !video || videoReady ? null : encoding?.key === videoKey ? encoding.percent : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Sharp at the box's own width, whatever the phone makes of 300 px.
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const shown = canvas.parentElement?.clientWidth || W
    const scale = (shown / W) * dpr
    if (!video) {
      renderShareCard(canvas, renderOptions(), scale)
      return
    }
    const options = renderOptions()
    const began = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = ((now - began) / 1000) % VIDEO_SECONDS
      renderShareCard(canvas, { ...options, ...videoFrameAt(t), loop: true }, scale)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [renderOptions, fontsReady, video])

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
  // Safari drops the tap's user activation across an await: the file must be ready before the tap, never awaited on it.
  const handleShareVideo = () => {
    const file = videoFiles[videoKey]
    if (!file) return
    void shareOrSaveFile(file, `${activity.description || t.activity.metaFallbackTitle} - RunOmics`)
  }
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
  const optionRow = 'flex shrink-0 items-center justify-between'

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end justify-center bg-[var(--scrim-sheet)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      onClick={close}
    >
      {/* The glass on the wrapper and the options' scroll inside it, so the glass never scrolls away. One height on every
          tab, a bar's height short of the top, so the scrim still dims the edge. */}
      <div
        ref={trapRef}
        data-testid="share-sheet"
        className={cn(glassClass('sheet'), 'flex h-[calc(100%-44px)] max-h-full w-full max-w-md animate-[sheet-rise_520ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col rounded-t-[var(--radius-sheet-large)] rounded-b-none sm:rounded-[var(--radius-sheet-large)]')}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <GlassLayers />
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{ padding: '6px 22px 0', paddingBottom: 'max(26px, var(--safe-bottom))' }}
        >
          <div className="flex shrink-0 justify-center" {...handleProps} style={{ ...handleProps.style }}>
            <span aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 2.5, background: 'rgb(127 127 127 / 0.45)' }} />
          </div>

          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center" style={{ marginTop: 10, height: 44 }}>
            <button
              type="button"
              onClick={close}
              aria-label={t.common.close}
              className={cn(SHEET_CONTROL, 'w-11 justify-self-start text-foreground')}
            >
              <X size={20} strokeWidth={2.2} />
            </button>
            <h2 className="text-headline text-foreground">{s.title}</h2>
            <span />
          </div>

          {/* The choice that changes the card most comes before it, not under it. */}
          <div
            role="radiogroup"
            aria-label={s.designTitle}
            // Equal segments come from SEGMENTED_FILL_SEGMENT_CLASS: a grid here loses
            // to the track's own flex when the classes merge.
            data-testid="share-designs"
            className={cn(SEGMENTED_TRACK, 'w-full')}
            style={{ marginTop: 10 }}
          >
            {designs.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={d === design}
                onClick={() => setDesign(d)}
                className={cn(segmentClass(d === design), SEGMENTED_FILL_SEGMENT_CLASS, 'h-[34px] text-[15px]')}
              >
                {s.designLabels[d]}
              </button>
            ))}
          </div>
          <div
            data-testid="share-preview"
            className="relative shrink-0 self-center overflow-hidden"
            style={{
              width: size === 'story' ? STORY_BOX_W : CARD_BOX_W, aspectRatio: ASPECT[size], marginTop: 14, borderRadius: 24, touchAction: 'pan-y',
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
            aria-busy={awaitingMap}
          >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: awaitingPhoto ? 'none' : 'block' }} />
            {awaitingMap && (
              <div data-testid="share-map-pending" className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <Loader2 size={22} strokeWidth={2} className="animate-spin text-muted-foreground" />
              </div>
            )}
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

          {/* Only the options scroll, between the preview and the buttons pinned under them. */}
          <div
            data-testid="share-sheet-body"
            className="-mx-[22px] mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div data-testid="share-size" className={optionRow} style={{ minHeight: 52 }}>
              <span className="text-foreground" style={{ fontSize: 17 }}>{s.sizeTitle}</span>
              <div role="radiogroup" aria-label={s.sizeTitle} className={cn('flex shrink-0', SEGMENTED_TRACK)}>
                {SHARE_SIZES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={size === option}
                    onClick={() => setSize(option)}
                    className={cn(segmentClass(size === option), 'h-[26px] px-3.5 text-[13px]')}
                  >
                    {s.sizeLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            {showFormat && (
              <div data-testid="share-format" className={optionRow} style={{ minHeight: 52 }}>
                <span className="text-foreground" style={{ fontSize: 17 }}>{s.formatTitle}</span>
                <div role="radiogroup" aria-label={s.formatTitle} className={cn('flex shrink-0', SEGMENTED_TRACK)}>
                  {(['image', 'video'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={format === f}
                      disabled={f === 'video' && !mapSettled}
                      onClick={() => setFormat(f)}
                      className={cn(segmentClass(format === f), 'h-[26px] px-3.5 text-[13px] disabled:opacity-40')}
                    >
                      {s.formatLabels[f]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* The empty frame is the one picker; once a photo is in, this row replaces it. */}
            {design === 'photo' ? photoImage && (
              <div data-testid="share-options" className={optionRow} style={{ minHeight: 52 }}>
                <span className="text-foreground" style={{ fontSize: 17 }}>{s.photo}</span>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center text-foreground" style={chip}>
                  {s.replacePhoto}
                </button>
              </div>
            ) : (
              <div data-testid="share-options" className={optionRow} style={{ minHeight: 52 }}>
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
              </div>
            )}

            {design === 'photo' && photoImage && hasRoute && (
              <div data-testid="share-photo-route" className={optionRow} style={{ minHeight: 52 }}>
                <span className="text-foreground" style={{ fontSize: 17 }}>{s.showRoute}</span>
                <Toggle checked={photoRoute} onChange={setPhotoRoute} label={s.showRoute} />
              </div>
            )}

            {activity.record && (
              <div data-testid="share-record" className={optionRow} style={{ minHeight: 52 }}>
                <span className="text-foreground" style={{ fontSize: 17 }}>{s.showRecord}</span>
                <Toggle checked={showRecord} onChange={setShowRecord} label={s.showRecord} />
              </div>
            )}

            {activity.reps && (
              <div data-testid="share-reps" className={optionRow} style={{ minHeight: 52 }}>
                <span className="text-foreground" style={{ fontSize: 17 }}>{s.showReps}</span>
                <Toggle checked={showReps} onChange={setShowReps} label={s.showReps} />
              </div>
            )}
          </div>

          <ShareCardActions
            canShareFiles={canShareFiles}
            canCopyImage={canCopyImage}
            copyState={copyState}
            disabled={awaitingPhoto || awaitingMap}
            video={video}
            preparing={preparing}
            onShare={video ? handleShareVideo : handleShare}
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
      </div>
    </div>,
    document.body
  )
}
