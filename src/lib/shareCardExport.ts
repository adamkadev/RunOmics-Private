import type { Activity } from '@/domain/activity/types'
import { renderShareCard, shareCardFileName, W, type RenderOptions, type ShareDesign } from '@/lib/shareCard'
import { saveFileWithFallback } from '@/lib/fileExport'

// Export at a 1080px-wide story - the resolution Instagram, Strava and Garmin
// all target. Deriving the scale from the card width keeps the output at that
// standard size (1080 x 1920) instead of the oversized 3x buffer it used to be.
const EXPORT_WIDTH = 1080
const EXPORT_SCALE = EXPORT_WIDTH / W

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    })
  })
}

/** Renders the card at export resolution on an offscreen canvas. */
function renderHiResBlob(options: RenderOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  renderShareCard(canvas, options, EXPORT_SCALE)
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
  await saveFileWithFallback(file)
}

/** Copies the PNG to the clipboard. The ClipboardItem must be constructed
 *  synchronously with a pending promise to keep Safari's user-gesture check. */
export function copyCardPng(options: RenderOptions): Promise<void> {
  const canvas = document.createElement('canvas')
  renderShareCard(canvas, options, EXPORT_SCALE)
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })])
}
