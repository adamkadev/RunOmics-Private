import type { Activity } from '@/domain/activity/types'
import { renderShareCard, shareCardFileName, type RenderOptions, type ShareDesign } from '@/lib/shareCard'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    })
  })
}

/** Renders the card at export resolution (3x) on an offscreen canvas. */
function renderHiResBlob(options: RenderOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  renderShareCard(canvas, options, 3)
  return canvasToBlob(canvas)
}

async function renderHiResFile(activity: Activity, design: ShareDesign, options: RenderOptions): Promise<File> {
  const blob = await renderHiResBlob(options)
  return new File([blob], shareCardFileName(activity, design), { type: 'image/png' })
}

/** Native share sheet. Falls back to nothing if the file can't be shared. */
export async function shareCardFile(
  activity: Activity,
  design: ShareDesign,
  options: RenderOptions,
  title: string
): Promise<void> {
  const file = await renderHiResFile(activity, design, options)
  if (!navigator.canShare({ files: [file] })) return
  try {
    await navigator.share({ files: [file], title })
  } catch (err) {
    if ((err as Error).name !== 'AbortError') console.error(err)
  }
}

/** Download as PNG. iOS PWAs have no downloads UI, so prefer the share sheet there. */
export async function saveCardPng(activity: Activity, design: ShareDesign, options: RenderOptions): Promise<void> {
  const file = await renderHiResFile(activity, design, options)

  const isIosPwa =
    /iPhone|iPad/.test(navigator.userAgent) &&
    'standalone' in navigator &&
    (navigator as unknown as { standalone: boolean }).standalone === true
  if (isIosPwa && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Copies the PNG to the clipboard. The ClipboardItem must be constructed
 *  synchronously with a pending promise to keep Safari's user-gesture check. */
export function copyCardPng(options: RenderOptions): Promise<void> {
  const canvas = document.createElement('canvas')
  renderShareCard(canvas, options, 3)
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })])
}
