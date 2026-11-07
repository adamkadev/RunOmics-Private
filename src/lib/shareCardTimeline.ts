/** The route video's clock, in seconds: the intro, the run drawing itself, the finish, then the still card held. */
export const VIDEO_CUES = { intro: 0, run: 1.2, finish: 8.2, hold: 9.8 } as const
export const VIDEO_SECONDS = 12.2
export const VIDEO_FPS = 30

/** The share of the route drawn; the clip's time, for the pops and fades. */
export interface VideoFrame {
  progress: number
  clipTime: number
}

export interface VideoMotion {
  /** 0 → 1 over the intro: the map's zoom and fade. */
  intro: number
  /** The start marker's pop, overshooting past 1 a little. */
  startPop: number
  /** The finish marker's pop. */
  finishPop: number
  /** 0 → 1 after the finish: the pace and heart rate fade in. */
  finish: number
  /** The route's opacity: it fades out at the loop's seam. */
  route: number
}

export const STILL_MOTION: VideoMotion = { intro: 1, startPop: 1, finishPop: 1, finish: 1, route: 1 }

export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2
export function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}

function span(t: number, start: number, end: number, ease: (x: number) => number): number {
  if (t <= start) return 0
  if (t >= end) return 1
  return ease((t - start) / (end - start))
}

export function videoFrameAt(t: number): VideoFrame {
  return { progress: span(t, VIDEO_CUES.run, VIDEO_CUES.finish, easeInOutSine), clipTime: t }
}

/** One frame of the still card first: WhatsApp and iMessage show a video's first frame as its thumbnail. */
export const EXPORT_FRAMES = Math.round(VIDEO_SECONDS * VIDEO_FPS) + 1

/** Null is the still card. */
export function exportFrameAt(f: number): VideoFrame | null {
  return f === 0 ? null : videoFrameAt((f - 1) / VIDEO_FPS)
}

/** `loop` fades the route out over the last 0.4 s, so a looping preview has a clean seam; the file keeps it. */
export function videoMotion(t: number, loop = false): VideoMotion {
  const { intro, finish } = VIDEO_CUES
  return {
    intro: span(t, intro, intro + 1, easeOutCubic),
    startPop: span(t, intro + 0.4, intro + 1, easeOutBack),
    finishPop: span(t, finish - 0.05, finish + 0.45, easeOutBack),
    finish: span(t, finish, finish + 0.8, easeOutCubic),
    route: loop ? 1 - span(t, VIDEO_SECONDS - 0.4, VIDEO_SECONDS, easeOutCubic) : 1,
  }
}

export type RepPhase =
  | { kind: 'none' }
  | { kind: 'warmUp' }
  | { kind: 'rep'; n: number; count: number }
  | { kind: 'recovery' }
  | { kind: 'coolDown' }

/** `windows` are shares of the route, in order; `progress` how much of it is drawn. */
export function repPhase(windows: readonly [number, number][], progress: number): RepPhase {
  if (windows.length === 0) return { kind: 'none' }
  const count = windows.length
  if (progress < windows[0]![0]) return { kind: 'warmUp' }
  for (let i = 0; i < count; i++) {
    const [from, to] = windows[i]!
    if (progress >= from && progress <= to) return { kind: 'rep', n: i + 1, count }
    const next = windows[i + 1]
    if (next && progress > to && progress < next[0]) return { kind: 'recovery' }
  }
  return { kind: 'coolDown' }
}
