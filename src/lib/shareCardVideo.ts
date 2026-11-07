import { renderShareCard, W, H, type RenderOptions } from '@/lib/shareCard'
import type { ShareActivity } from '@/lib/shareCardStats'
import { VIDEO_FPS, VIDEO_SECONDS, videoFrameAt } from '@/lib/shareCardTimeline'

const EXPORT_WIDTH = 1080
const EXPORT_SCALE = EXPORT_WIDTH / W
/** Around 6 Mbps holds the map's detail; 12 s of it stays well under WhatsApp's limit. */
const BITRATE = 6_000_000
const FRAMES = Math.round(VIDEO_SECONDS * VIDEO_FPS)

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
  renderShareCard(canvas, { ...options, ...videoFrameAt(f / VIDEO_FPS) }, EXPORT_SCALE)
}

/** Frame-exact and faster than real time. */
async function encodeWebCodecs(options: RenderOptions, onProgress: (share: number) => void): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny')
  const canvas = document.createElement('canvas')
  drawFrame(canvas, options, 0)
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: BITRATE, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: VIDEO_FPS })
  await output.start()
  for (let f = 0; f < FRAMES; f++) {
    drawFrame(canvas, options, f)
    await source.add(f / VIDEO_FPS, 1 / VIDEO_FPS)
    if (f % 10 === 0) onProgress(f / FRAMES)
  }
  await output.finalize()
  const buffer = output.target.buffer
  if (!buffer) throw new Error('empty video')
  return new Blob([buffer], { type: 'video/mp4' })
}

/** Real time: the recorder samples the canvas as it is drawn. */
function encodeRecorder(options: RenderOptions, onProgress: (share: number) => void): Promise<Blob> {
  const type = recorderType()
  if (!type) return Promise.reject(new Error('no video encoder'))
  const canvas = document.createElement('canvas')
  drawFrame(canvas, options, 0)
  const stream = canvas.captureStream(VIDEO_FPS)
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: BITRATE })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      resolve(new Blob(chunks, { type: type.split(';')[0] }))
    }
    recorder.onerror = () => reject(new Error('recording failed'))
    recorder.start()
    const began = performance.now()
    const tick = () => {
      const f = Math.min(FRAMES - 1, Math.floor(((performance.now() - began) / 1000) * VIDEO_FPS))
      drawFrame(canvas, options, f)
      onProgress(f / FRAMES)
      if (f < FRAMES - 1) requestAnimationFrame(tick)
      else recorder.stop()
    }
    requestAnimationFrame(tick)
  })
}

export async function renderShareVideo(
  activity: ShareActivity, options: RenderOptions, kind: VideoEncoderKind, onProgress: (share: number) => void,
): Promise<File> {
  const blob = kind === 'webcodecs'
    ? await encodeWebCodecs(options, onProgress).catch(() => encodeRecorder(options, onProgress))
    : await encodeRecorder(options, onProgress)
  onProgress(1)
  return new File([blob], shareVideoFileName(activity, blob.type), { type: blob.type })
}
