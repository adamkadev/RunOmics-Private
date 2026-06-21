'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, ImagePlus, Share2, X } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { SHARE_TEMPLATES, loadImage, renderShareCard, shareCardFileName } from '@/lib/shareCard'
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

export function ShareCardModal({ activity, canShareFiles, canCopyImage, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    SHARE_TEMPLATES.forEach((template, i) => {
      const canvas = canvasRefs.current[i]
      if (canvas) renderShareCard(canvas, activity, template, photoImage)
    })
  }, [activity, photoImage])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    return () => {
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current)
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
    const file = new File([blob], shareCardFileName(activity, SHARE_TEMPLATES[activeIndex]), { type: 'image/png' })
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
    a.download = shareCardFileName(activity, SHARE_TEMPLATES[activeIndex])
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
          {SHARE_TEMPLATES.map((template, i) => (
            <div key={template} className="flex w-full shrink-0 snap-center items-center justify-center p-4">
              <div className="relative aspect-[9/16] max-h-[60vh] w-full overflow-hidden rounded-xl bg-muted">
                <canvas
                  ref={(el) => {
                    canvasRefs.current[i] = el
                  }}
                  className="block h-full w-full object-contain"
                />
                {template === 'photo' && !photoImage && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-medium text-white/80"
                  >
                    <ImagePlus size={28} />
                    {t.activity.shareCard.choosePhoto}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 py-2">
          {SHARE_TEMPLATES.map((template, i) => (
            <button
              key={template}
              onClick={() => scrollToIndex(i)}
              aria-label={t.activity.shareCard.slideLabel(i + 1)}
              className={cn('h-1.5 w-1.5 rounded-full transition-colors', i === activeIndex ? 'bg-accent' : 'bg-border')}
            />
          ))}
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

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      </div>
    </div>
  )
}
