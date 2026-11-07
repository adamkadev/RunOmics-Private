import { renderShareCard, W, H, type RenderOptions } from '@/lib/shareCard'
import type { ShareActivity } from '@/lib/shareCardStats'
import { EXPORT_FRAMES as FRAMES, exportFrameAt, VIDEO_FPS } from '@/lib/shareCardTimeline'

const EXPORT_WIDTH = 1080
const EXPORT_SCALE = EXPORT_WIDTH / W
/** Around 6 Mbps holds the map's detail; 12 s of it stays well under WhatsApp's limit. */
const BITRATE = 6_000_000

export type VideoEncoderKind = 'webcodecs' | 'recorder'

/** The MediaRecorder types to try: MP4 first, which Safari records and iOS WhatsApp plays; WebM only as a last resort. */
const RECORDER_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']

function recorderType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

/** Null hides the Video option: neither WebCodecs nor MediaRecorder is there. */
export async function shareVideoEncoder(): Promise<VideoEncoderKind | null> {
  if (typeof window === 'undefined') return null
  if (typeof VideoEncoder !== 'undefined') {
    try {
      const { canEncodeVideo } = await import('mediabunny')
      if (await canEncodeVideo('avc', { width: EXPORT_WIDTH, height: Math.round(H * EXPORT_SCALE), bitrate: BITRATE })) return 'webcodecs'
    } catch {
      // Falls through to MediaRecorder.
    }
  }
  return recorderType() ? 'recorder' : null
}

export function shareVideoFileName(activity: ShareActivity, type: string): string {
  return `runomics-${activity.date}-route.${type.includes('mp4') ? 'mp4' : 'webm'}`
}

function drawFrame(canvas: HTMLCanvasElement, options: RenderOptions, f: number) {
  renderShareCard(canvas, { ...options, ...exportFrameAt(f) }, EXPORT_SCALE)
}

function aborted(): DOMException {
  return new DOMException('video encode cancelled', 'AbortError')
}

/** Frame-exact and faster than real time. */
async function encodeWebCodecs(options: RenderOptions, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny')
  if (signal?.aborted) throw aborted()
  const canvas = document.createElement('canvas')
  drawFrame(canvas, options, 0)
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: BITRATE, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: VIDEO_FPS })
  await output.start()
  try {
    for (let f = 0; f < FRAMES; f++) {
      if (signal?.aborted) throw aborted()
      drawFrame(canvas, options, f)
      await source.add(f / VIDEO_FPS, 1 / VIDEO_FPS)
      if (f % 10 === 0) onProgress(f / FRAMES)
    }
  } catch (err) {
    // Closes the encoder: an abandoned one keeps its hardware session until collected.
    await output.cancel().catch(() => {})
    throw err
  }
  await output.finalize()
  const buffer = output.target.buffer
  if (!buffer) throw new Error('empty video')
  return new Blob([buffer], { type: 'video/mp4' })
}

/** Real time: the recorder samples the canvas as it is drawn. */
function encodeRecorder(options: RenderOptions, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Blob> {
  const type = recorderType()
  if (!type) return Promise.reject(new Error('no video encoder'))
  if (signal?.aborted) return Promise.reject(aborted())
  const canvas = document.createElement('canvas')
  drawFrame(canvas, options, 0)
  const stream = canvas.captureStream(VIDEO_FPS)
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: BITRATE })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  return new Promise((resolve, reject) => {
    let frame = 0
    let cancelled = false
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      if (cancelled) reject(aborted())
      else resolve(new Blob(chunks, { type: type.split(';')[0] }))
    }
    recorder.onerror = () => reject(new Error('recording failed'))
    signal?.addEventListener('abort', () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (recorder.state !== 'inactive') recorder.stop()
    }, { once: true })
    recorder.start()
    // The still card is already on the canvas: the clip starts a frame later, after the recorder has sampled it.
    const began = performance.now() + 1000 / VIDEO_FPS
    const tick = () => {
      const f = Math.min(FRAMES - 1, 1 + Math.max(0, Math.floor(((performance.now() - began) / 1000) * VIDEO_FPS)))
      if (performance.now() >= began) drawFrame(canvas, options, f)
      onProgress(f / FRAMES)
      if (f < FRAMES - 1) frame = requestAnimationFrame(tick)
      else recorder.stop()
    }
    frame = requestAnimationFrame(tick)
  })
}

/** Rejects with an AbortError once `signal` aborts: the frame loop stops and the encoder is closed. */
export async function renderShareVideo(
  activity: ShareActivity, options: RenderOptions, kind: VideoEncoderKind, onProgress: (share: number) => void, signal?: AbortSignal,
): Promise<File> {
  const blob = kind === 'webcodecs'
    ? await encodeWebCodecs(options, onProgress, signal).catch((err: unknown) => {
      if (signal?.aborted) throw err
      return encodeRecorder(options, onProgress, signal)
    })
    : await encodeRecorder(options, onProgress, signal)
  onProgress(1)
  return new File([blob], shareVideoFileName(activity, blob.type), { type: blob.type })
}
