import type { ShareActivity } from '@/lib/shareCardStats'
import { renderShareCard, shareCardFileName, W, type RenderOptions, type ShareDesign } from '@/lib/shareCard'
import { saveFileWithFallback } from '@/lib/fileExport'

const EXPORT_WIDTH = 1080
const EXPORT_SCALE = EXPORT_WIDTH / W

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    })
  })
}

function renderHiResBlob(options: RenderOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  renderShareCard(canvas, options, EXPORT_SCALE)
  return canvasToBlob(canvas)
}

async function renderHiResFile(activity: ShareActivity, design: ShareDesign, options: RenderOptions): Promise<File> {
  const blob = await renderHiResBlob(options)
  return new File([blob], shareCardFileName(activity, design), { type: 'image/png' })
}

export async function shareCardFile(
  activity: ShareActivity,
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

export async function saveCardPng(activity: ShareActivity, design: ShareDesign, options: RenderOptions): Promise<void> {
  const file = await renderHiResFile(activity, design, options)
  await saveFileWithFallback(file)
}

export function copyCardPng(options: RenderOptions): Promise<void> {
  const canvas = document.createElement('canvas')
  renderShareCard(canvas, options, EXPORT_SCALE)
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })])
}
