'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Check, Copy, Download, ImagePlus, Map, Moon, Route, Share2, Sun, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon: LucideIcon
  disabled?: boolean
}

function SegmentedGlass<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentedOption<T>[]
}) {
  return (
    <div className="inline-flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          disabled={opt.disabled}
          className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            value === opt.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          )}
        >
          <opt.icon size={12} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

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
  const [brandMark, setBrandMark] = useState<HTMLImageElement | null>(null)
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

  useEffect(() => {
    loadImage('/backgrounds/branding-mark.png')
      .then(setBrandMark)
      .catch((err) => console.error(err))
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
      if (canvas) renderShareCard(canvas, { activity, style, accent, theme, mapMode, bgImage, mapImage, brandMark })
    })
  }, [activity, accent, theme, mapMode, bgImages, mapImage, photoImage, brandMark])

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-sheet relative flex max-h-[92vh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-3xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2.5 sm:hidden">
          <span className="h-[5px] w-[38px] rounded-full bg-foreground/25" aria-hidden="true" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
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
                <GlassSurface
                  variant="card"
                  className={cn('relative aspect-[9/16] max-h-[60vh] max-w-full overflow-hidden rounded-xl', style === 'photo' && 'bg-card')}
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
                </GlassSurface>
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

          <GlassSurface variant="card" className="mx-3 mb-3 flex flex-col gap-3 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-subtle">{t.activity.shareCard.colorLabel}</span>
              <div className="flex gap-2">
                {ACCENT_IDS.map((id) => {
                  const color = ACCENT_SWATCHES[id]
                  const active = accent === id
                  return (
                    <button
                      key={id}
                      onClick={() => setAccent(id)}
                      aria-label={t.settings.accent.options[id].label}
                      aria-pressed={active}
                      style={{
                        backgroundColor: color,
                        boxShadow: active ? `0 0 0 2px var(--glass-bg-sheet), 0 0 0 4px ${color}` : 'none',
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-shadow active:scale-90"
                    >
                      {active && <Check size={13} className="text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-subtle">{t.activity.shareCard.theme.label}</span>
              <SegmentedGlass
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: t.activity.shareCard.theme.light, icon: Sun },
                  { value: 'dark', label: t.activity.shareCard.theme.dark, icon: Moon },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-subtle">{t.activity.shareCard.mapMode.label}</span>
              <SegmentedGlass
                value={mapMode}
                onChange={setMapMode}
                options={[
                  { value: 'run', label: t.activity.shareCard.mapMode.run, icon: Route },
                  { value: 'map', label: t.activity.shareCard.mapMode.map, icon: Map, disabled: !canUseMap },
                  { value: 'none', label: t.activity.shareCard.mapMode.none, icon: Ban },
                ]}
              />
            </div>
          </GlassSurface>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-border/60 p-3">
          {canShareFiles && (
            <Button onClick={handleShare} className="w-full">
              <Share2 size={15} />
              {t.activity.shareMenu.share}
            </Button>
          )}
          <Button variant="secondary" onClick={handleSave} className="w-full">
            <Download size={15} />
            {t.activity.shareMenu.download}
          </Button>
          {canCopyImage && (
            <Button
              variant="secondary"
              onClick={handleCopy}
              className={cn('w-full', copyState === 'copied' && 'text-accent-text')}
            >
              {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
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
