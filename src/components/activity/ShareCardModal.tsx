'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, Map, Route, Share2, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import {
  SHARE_STYLES,
  backgroundSrc,
  loadImage,
  renderShareCard,
  shareCardFileName,
  staticMapUrl,
  type MapMode,
} from '@/lib/shareCard'
import { DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activity: Activity
  canShareFiles: boolean
  canCopyImage: boolean
  onClose: () => void
}

type CopyState = 'idle' | 'copied'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/png')
  })
}

function currentAccent(): AccentId {
  if (typeof document === 'undefined') return DEFAULT_ACCENT
  const value = document.documentElement.getAttribute('data-accent')
  return isAccentId(value) ? value : DEFAULT_ACCENT
}

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const [accent] = useState<AccentId>(currentAccent)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mapMode, setMapMode] = useState<MapMode>('run')
  const [bgImages, setBgImages] = useState<(HTMLImageElement | null)[]>(() => SHARE_STYLES.map(() => null))
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

  const hasRoute = !!activity.route && activity.route.length > 1
  const mapToken = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  const canUseMap = hasRoute && !!mapToken

  useEffect(() => {
    let cancelled = false
    Promise.all(
      SHARE_STYLES.map((style) =>
        loadImage(backgroundSrc(accent, style)).catch((err) => {
          console.error(err)
          return null
        })
      )
    ).then((images) => {
      if (!cancelled) setBgImages(images)
    })
    return () => {
      cancelled = true
    }
  }, [accent])

  useEffect(() => {
    if (mapMode !== 'map' || mapImage || !canUseMap) return
    const url = staticMapUrl(activity, accent, true, mapToken)
    if (!url) return
    let cancelled = false
    loadImage(url, true)
      .then((img) => {
        if (!cancelled) setMapImage(img)
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [mapMode, mapImage, canUseMap, activity, accent, mapToken])

  useEffect(() => {
    SHARE_STYLES.forEach((style, i) => {
      const canvas = canvasRefs.current[i]
      if (canvas) renderShareCard(canvas, { activity, style, accent, mapMode, bgImage: bgImages[i], mapImage })
    })
  }, [activity, accent, mapMode, bgImages, mapImage])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex((prev) => (prev === index ? prev : index))
  }

  function scrollToIndex(index: number) {
    scrollRef.current?.scrollTo({ left: index * scrollRef.current.clientWidth, behavior: 'smooth' })
  }

  async function handleShare() {
    const canvas = canvasRefs.current[activeIndex]
    if (!canvas) return
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], shareCardFileName(activity, SHARE_STYLES[activeIndex]), { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    }
  }

  async function handleSave() {
    const canvas = canvasRefs.current[activeIndex]
    if (!canvas) return
    const blob = await canvasToBlob(canvas)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = shareCardFileName(activity, SHARE_STYLES[activeIndex])
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function handleCopy() {
    const canvas = canvasRefs.current[activeIndex]
    if (!canvas) return
    // navigator.clipboard.write() must run synchronously within the click handler
    // (no preceding await) or iOS Safari drops user activation and rejects it.
    // Passing a pending Blob promise into ClipboardItem lets WebKit wait for it.
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })])
      .then(() => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 1500)
      })
      .catch((err) => {
        console.error(err)
        setCopyState('idle')
      })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t.activity.share}</h2>
          <button
            onClick={onClose}
            aria-label={t.activity.shareCard.close}
            className="rounded-md p-1 text-subtle transition-colors hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="flex snap-x snap-mandatory overflow-x-auto">
          {SHARE_STYLES.map((style, i) => (
            <div key={style} className="flex w-full shrink-0 snap-center items-center justify-center p-4">
              <div className="relative aspect-[9/16] max-h-[60vh] w-full overflow-hidden rounded-xl bg-muted">
                <canvas
                  ref={(el) => {
                    canvasRefs.current[i] = el
                  }}
                  className="block h-full w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 py-2">
          {SHARE_STYLES.map((style, i) => (
            <button
              key={style}
              onClick={() => scrollToIndex(i)}
              aria-label={t.activity.shareCard.styleLabels[style]}
              className={cn('h-1.5 w-1.5 rounded-full transition-colors', i === activeIndex ? 'bg-accent' : 'bg-border')}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 px-3 pb-1">
          <span className="mr-1 text-xs font-medium text-subtle">{t.activity.shareCard.mapMode.label}</span>
          <button
            onClick={() => setMapMode('run')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              mapMode === 'run' ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
            )}
          >
            <Route size={13} />
            {t.activity.shareCard.mapMode.run}
          </button>
          <button
            onClick={() => setMapMode('map')}
            disabled={!canUseMap}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              mapMode === 'map' ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
            )}
          >
            <Map size={13} />
            {t.activity.shareCard.mapMode.map}
          </button>
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          {canShareFiles && (
            <button
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              <Share2 size={15} />
              {t.activity.shareMenu.share}
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download size={15} />
            {t.activity.shareMenu.download}
          </button>
          {canCopyImage && (
            <button
              onClick={handleCopy}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                copyState === 'copied' ? 'text-accent-text' : 'text-foreground'
              )}
            >
              {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
              {copyState === 'copied' ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
