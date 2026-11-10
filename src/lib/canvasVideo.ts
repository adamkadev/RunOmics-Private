export type VideoEncoderKind = 'webcodecs' | 'recorder'

/** A clip drawn frame by frame onto one canvas; frame 0 is drawn first, before encoding starts. */
export interface CanvasClip {
  width: number
  height: number
  frames: number
  fps: number
  bitrate: number
  draw: (canvas: HTMLCanvasElement, frame: number) => void
}

/** The MediaRecorder types to try: MP4 first, which Safari records and iOS WhatsApp plays; WebM only as a last resort. */
const RECORDER_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']

function recorderType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

/** Null means neither WebCodecs nor MediaRecorder is there. */
export async function canvasVideoEncoder(width: number, height: number, bitrate: number): Promise<VideoEncoderKind | null> {
  if (typeof window === 'undefined') return null
  if (typeof VideoEncoder !== 'undefined') {
    try {
      const { canEncodeVideo } = await import('mediabunny')
      if (await canEncodeVideo('avc', { width, height, bitrate })) return 'webcodecs'
    } catch {
      // Falls through to MediaRecorder.
    }
  }
  return recorderType() ? 'recorder' : null
}

export function videoExtension(type: string): 'mp4' | 'webm' {
  return type.includes('mp4') ? 'mp4' : 'webm'
}

function aborted(): DOMException {
  return new DOMException('video encode cancelled', 'AbortError')
}

function firstFrame(clip: CanvasClip): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = clip.width
  canvas.height = clip.height
  clip.draw(canvas, 0)
  return canvas
}

/** Frame-exact and faster than real time. */
async function encodeWebCodecs(clip: CanvasClip, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny')
  if (signal?.aborted) throw aborted()
  const canvas = firstFrame(clip)
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: clip.bitrate, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: clip.fps })
  await output.start()
  try {
    for (let f = 0; f < clip.frames; f++) {
      if (signal?.aborted) throw aborted()
      clip.draw(canvas, f)
      await source.add(f / clip.fps, 1 / clip.fps)
      if (f % 10 === 0) onProgress(f / clip.frames)
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
function encodeRecorder(clip: CanvasClip, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Blob> {
  const type = recorderType()
  if (!type) return Promise.reject(new Error('no video encoder'))
  if (signal?.aborted) return Promise.reject(aborted())
  const canvas = firstFrame(clip)
  const stream = canvas.captureStream(clip.fps)
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: clip.bitrate })
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
    // Frame 0 is already on the canvas: the clip starts a frame later, after the recorder has sampled it.
    const began = performance.now() + 1000 / clip.fps
    const last = clip.frames - 1
    const tick = () => {
      const f = Math.min(last, 1 + Math.max(0, Math.floor(((performance.now() - began) / 1000) * clip.fps)))
      if (performance.now() >= began) clip.draw(canvas, f)
      onProgress(f / clip.frames)
      if (f < last) frame = requestAnimationFrame(tick)
      else recorder.stop()
    }
    frame = requestAnimationFrame(tick)
  })
}

/** Rejects with an AbortError once `signal` aborts: the frame loop stops and the encoder is closed. */
export async function encodeCanvasClip(clip: CanvasClip, kind: VideoEncoderKind, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Blob> {
  const blob = kind === 'webcodecs'
    ? await encodeWebCodecs(clip, onProgress, signal).catch((err: unknown) => {
      if (signal?.aborted) throw err
      return encodeRecorder(clip, onProgress, signal)
    })
    : await encodeRecorder(clip, onProgress, signal)
  onProgress(1)
  return blob
}
