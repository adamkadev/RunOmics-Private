'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Check, Copy, Download, ImagePlus, Map, Moon, Route, Share2, Sun, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import {
  MAP_BOX,
  SHARE_STYLES,
  backgroundSrc,
  loadImage,
  renderShareCard,
  shareCardFileName,
  type MapMode,
  type ShareTheme,
} from '@/lib/shareCard'
import { captureRouteMapSnapshot } from '@/lib/routeMapSnapshot'
import { ACCENT_IDS, ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'
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

// Defaults to whichever theme matches the site's current dark/light mode; the user can still override it.
function currentTheme(): ShareTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const [accent, setAccent] = useState<AccentId>(currentAccent)
  const [theme, setTheme] = useState<ShareTheme>(currentTheme)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mapMode, setMapMode] = useState<MapMode>('run')
  const [bgImages, setBgImages] = useState<(HTMLImageElement | null)[]>(() => SHARE_STYLES.map(() => null))
  // Keyed by accent+theme so a stale tile (wrong color/text mode) is never shown while the new one loads.
  const [mapTile, setMapTile] = useState<{ key: string; img: HTMLImageElement } | null>(null)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoObjectUrlRef = useRef<string | null>(null)

  const hasRoute = !!activity.route && activity.route.length > 1
  const mapToken = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  const canUseMap = hasRoute && !!mapToken

  useEffect(() => {
    let cancelled = false
    Promise.all(
      SHARE_STYLES.map((style) =>
        // 'photo' has no built-in background; the canvas stays transparent until the user picks one.
        style === 'photo'
          ? Promise.resolve(null)
          : loadImage(backgroundSrc(accent, style, theme)).catch((err) => {
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
  }, [accent, theme])

  useEffect(() => {
    return () => {
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current)
    }
  }, [])

  const mapKey = canUseMap ? `${accent}:${theme}` : null
  const mapImage = mapTile?.key === mapKey ? mapTile.img : null

  useEffect(() => {
    if (mapMode !== 'map' || !mapKey || !mapToken || !activity.route || mapTile?.key === mapKey) return
    let cancelled = false
    captureRouteMapSnapshot({
      route: activity.route,
      color: ACCENT_SWATCHES[accent],
      isDark: theme === 'dark',
      token: mapToken,
      width: MAP_BOX.w,
      height: MAP_BOX.h,
    })
      .then((dataUrl) => loadImage(dataUrl))
      .then((img) => {
        if (!cancelled) setMapTile({ key: mapKey, img })
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [mapMode, mapKey, mapToken, activity.route, accent, theme, mapTile])

  useEffect(() => {
    SHARE_STYLES.forEach((style, i) => {
      const canvas = canvasRefs.current[i]
      const bgImage = style === 'photo' ? photoImage ?? bgImages[i] : bgImages[i]
      if (canvas) renderShareCard(canvas, { activity, style, accent, theme, mapMode, bgImage, mapImage })
    })
  }, [activity, accent, theme, mapMode, bgImages, mapImage, photoImage])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const { style: htmlStyle } = document.documentElement
    const prevOverflow = htmlStyle.overflow
    htmlStyle.overflow = 'hidden'
    return () => {
      htmlStyle.overflow = prevOverflow
    }
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex((prev) => (prev === index ? prev : index))
  }

  function scrollToIndex(index: number) {
    scrollRef.current?.scrollTo({ left: index * scrollRef.current.clientWidth, behavior: 'smooth' })
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    loadImage(url)
      .then((img) => {
        if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current)
        photoObjectUrlRef.current = url
        setPhotoImage(img)
      })
      .catch((err) => {
        console.error(err)
        URL.revokeObjectURL(url)
      })
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t.activity.share}</h2>
          <button
            onClick={onClose}
            aria-label={t.activity.shareCard.close}
            className="rounded-md p-1 text-subtle transition-colors hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div ref={scrollRef} onScroll={handleScroll} className="flex snap-x snap-mandatory overflow-x-auto">
            {SHARE_STYLES.map((style, i) => (
              <div key={style} className="flex w-full shrink-0 snap-center items-center justify-center p-4">
                <div
                  className={cn('relative aspect-[9/16] max-h-[60vh] max-w-full overflow-hidden rounded-xl', style === 'photo' ? 'bg-card' : 'bg-muted')}
                  style={
                    style === 'photo'
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg, rgba(148, 163, 184, 0.25) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.25) 75%), linear-gradient(45deg, rgba(148, 163, 184, 0.25) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.25) 75%)',
                          backgroundSize: '24px 24px',
                          backgroundPosition: '0 0, 12px 12px',
                        }
                      : undefined
                  }
                >
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[i] = el
                    }}
                    className="block h-full w-full object-contain"
                  />
                  {style === 'photo' && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                    >
                      <ImagePlus size={14} />
                      {t.activity.shareCard.choosePhoto}
                    </button>
                  )}
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

          <div className="flex items-center justify-center gap-2 px-3 pb-2">
            <span className="mr-1 text-xs font-medium text-subtle">{t.activity.shareCard.colorLabel}</span>
            {ACCENT_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setAccent(id)}
                aria-label={t.settings.accent.options[id].label}
                style={{ backgroundColor: ACCENT_SWATCHES[id] }}
                className={cn(
                  'h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-card transition-shadow',
                  accent === id ? 'ring-foreground' : 'ring-transparent'
                )}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 px-3 pb-2">
            <span className="mr-1 text-xs font-medium text-subtle">{t.activity.shareCard.theme.label}</span>
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                theme === 'light' ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
              )}
            >
              <Sun size={13} />
              {t.activity.shareCard.theme.light}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                theme === 'dark' ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
              )}
            >
              <Moon size={13} />
              {t.activity.shareCard.theme.dark}
            </button>
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
            <button
              onClick={() => setMapMode('none')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                mapMode === 'none' ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
              )}
            >
              <Ban size={13} />
              {t.activity.shareCard.mapMode.none}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border p-3">
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

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      </div>
    </div>,
    document.body
  )
}
