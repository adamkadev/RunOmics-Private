import { renderShareCard, shareCardHeight, W, type RenderOptions, type ShareSize } from '@/lib/shareCard'
import type { ShareActivity } from '@/lib/shareCardStats'
import { EXPORT_FRAMES as FRAMES, exportFrameAt, VIDEO_FPS } from '@/lib/shareCardTimeline'
import { canvasVideoEncoder, encodeCanvasClip, videoExtension, type CanvasClip, type VideoEncoderKind } from '@/lib/canvasVideo'

export type { VideoEncoderKind }

const EXPORT_WIDTH = 1080
const EXPORT_SCALE = EXPORT_WIDTH / W
/** Around 6 Mbps holds the map's detail; 12 s of it stays well under WhatsApp's limit. */
const BITRATE = 6_000_000

/** Null hides the Video option: neither WebCodecs nor MediaRecorder is there. */
export function shareVideoEncoder(size: ShareSize = 'portrait'): Promise<VideoEncoderKind | null> {
  return canvasVideoEncoder(EXPORT_WIDTH, Math.round(shareCardHeight(size) * EXPORT_SCALE), BITRATE)
}

export function shareVideoFileName(activity: ShareActivity, type: string): string {
  return `runomics-${activity.date}-route.${videoExtension(type)}`
}

/** Rejects with an AbortError once `signal` aborts: the frame loop stops and the encoder is closed. */
export async function renderShareVideo(
  activity: ShareActivity, options: RenderOptions, kind: VideoEncoderKind, onProgress: (share: number) => void, signal?: AbortSignal,
): Promise<File> {
  const clip: CanvasClip = {
    width: EXPORT_WIDTH,
    height: Math.round(shareCardHeight(options.size) * EXPORT_SCALE),
    frames: FRAMES,
    fps: VIDEO_FPS,
    bitrate: BITRATE,
    draw: (canvas, f) => renderShareCard(canvas, { ...options, ...exportFrameAt(f) }, EXPORT_SCALE),
  }
  const blob = await encodeCanvasClip(clip, kind, onProgress, signal)
  return new File([blob], shareVideoFileName(activity, blob.type), { type: blob.type })
}
