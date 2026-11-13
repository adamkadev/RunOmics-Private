import { finishBins, headAt, warpSeconds } from '@/domain/activity/homeRuns'
import { hexToRgb, rgbCss } from '@/lib/heatRamp'
import { decodeIntegers, decodePolyline } from '@/lib/polyline'
import { percentileBounds } from '@/lib/routeFrame'

export const REPLAY_FPS = 30
/** A still beat on the start, the runs, then the finished picture held. */
export const REPLAY_CUES = { start: 1, run: 21, end: 24 } as const
export const REPLAY_FRAMES = Math.round(REPLAY_CUES.end * REPLAY_FPS)
/** 9:16, the shape a phone plays full screen. */
export const REPLAY_WIDTH = 1080
export const REPLAY_HEIGHT = 1920

const BIN_SECONDS = 600
const MAX_BINS = 12
const BACKGROUND = '#0a0c10'

export interface ReplayRun {
  /** Projected into a unit box, x then y, the box's aspect kept in `aspect`. */
  xy: Float32Array
  times: number[]
  duration: number
}

export interface ReplayLabels {
  title: string
  subtitle: string
  running: (n: number, of: number) => string
  finished: (n: number) => string
  /** Under the finish-time bars, which start empty and would read as a progress bar. */
  histogram: string
  /** Over the timer, which would read as a time of day. */
  elapsed: string
}

export interface ReplayScene {
  runs: ReplayRun[]
  /** Width over height of the projected box. */
  aspect: number
  maxSeconds: number
  binCount: number
  accent: string
  font: string
  labels: ReplayLabels
}

const mercX = (lon: number) => (lon + 180) / 360
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
}

export function buildReplayScene(
  runs: readonly { track: string; times: string; durationSeconds: number }[],
  style: { accent: string; font: string; labels: ReplayLabels },
): ReplayScene {
  const tracks = runs.map((r) => decodePolyline(r.track))
  const frame = percentileBounds(tracks, 0.01)
  const x0 = frame ? mercX(frame.minLon) : 0
  const x1 = frame ? mercX(frame.maxLon) : 1
  const y0 = frame ? mercY(frame.maxLat) : 0
  const y1 = frame ? mercY(frame.minLat) : 1
  const wide = Math.max(1e-9, x1 - x0)
  const tall = Math.max(1e-9, y1 - y0)
  const replayRuns = runs.map((r, i) => {
    const track = tracks[i]!
    const xy = new Float32Array(track.length * 2)
    track.forEach(([lon, lat], k) => {
      xy[k * 2] = (mercX(lon) - x0) / wide
      xy[k * 2 + 1] = (mercY(lat) - y0) / tall
    })
    let sum = 0
    const times = decodeIntegers(r.times).map((d) => (sum += d))
    return { xy, times, duration: r.durationSeconds }
  })
  const maxSeconds = Math.max(1, ...replayRuns.map((r) => r.duration))
  return {
    runs: replayRuns,
    aspect: wide / tall,
    maxSeconds,
    binCount: Math.min(MAX_BINS, Math.max(1, Math.ceil(maxSeconds / BIN_SECONDS))),
    ...style,
  }
}

/** Run seconds shown at `t` seconds into the replay. */
export function replaySeconds(t: number, maxSeconds: number): number {
  const { start, run } = REPLAY_CUES
  return warpSeconds((t - start) / (run - start), maxSeconds)
}

export function formatClock(seconds: number): string {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${h}:${pad(m)}:${pad(s % 60)}`
}

/** Draws the replay at `seconds` of run time filling a w × h canvas. */
export function drawReplay(ctx: CanvasRenderingContext2D, scene: ReplayScene, seconds: number, w: number, h: number): void {
  const u = Math.min(w, h * (9 / 16)) / 1080
  const accent = hexToRgb(scene.accent)
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, w, h)

  const top = 250 * u
  const bottom = 430 * u
  const side = 60 * u
  const boxW = w - side * 2
  const boxH = Math.max(1, h - top - bottom)
  const fit = Math.min(boxW / scene.aspect, boxH)
  const mapW = fit * scene.aspect
  const mapH = fit
  const ox = side + (boxW - mapW) / 2
  const oy = top + (boxH - mapH) / 2
  const px = (xy: Float32Array, k: number) => ox + xy[k * 2]! * mapW
  const py = (xy: Float32Array, k: number) => oy + xy[k * 2 + 1]! * mapH

  ctx.save()
  // The frame leaves out the farthest 1 % of points, which would otherwise run under the title or the clock.
  ctx.beginPath()
  ctx.rect(0, top - 20 * u, w, boxH + 40 * u)
  ctx.clip()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1.2 * u
  ctx.beginPath()
  for (const run of scene.runs) {
    const n = run.xy.length / 2
    for (let k = 0; k < n; k++) {
      if (k === 0) ctx.moveTo(px(run.xy, k), py(run.xy, k))
      else ctx.lineTo(px(run.xy, k), py(run.xy, k))
    }
  }
  ctx.stroke()

  // Additive, so a street run fifty times glows where one run once stays dim.
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = rgbCss(accent, Math.min(0.5, 6 / Math.max(12, scene.runs.length)))
  ctx.lineWidth = 2.4 * u
  const heads: [number, number][] = []
  let running = 0
  for (const run of scene.runs) {
    const { index, within } = headAt(run.times, seconds)
    if (index < 0) continue
    ctx.beginPath()
    ctx.moveTo(px(run.xy, 0), py(run.xy, 0))
    for (let k = 1; k <= index; k++) ctx.lineTo(px(run.xy, k), py(run.xy, k))
    let hx = px(run.xy, index)
    let hy = py(run.xy, index)
    if (within > 0) {
      hx += (px(run.xy, index + 1) - hx) * within
      hy += (py(run.xy, index + 1) - hy) * within
      ctx.lineTo(hx, hy)
    }
    ctx.stroke()
    if (seconds < run.duration) {
      running++
      heads.push([hx, hy])
    }
  }

  ctx.globalCompositeOperation = 'source-over'
  for (const [x, y] of heads) {
    ctx.fillStyle = rgbCss(accent, 0.35)
    ctx.beginPath()
    ctx.arc(x, y, 9 * u, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, 4 * u, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${72 * u}px ${scene.font}`
  ctx.fillText(scene.labels.title, side, 140 * u)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `500 ${36 * u}px ${scene.font}`
  ctx.fillText(scene.labels.subtitle, side, 196 * u)

  const footer = h - bottom + 60 * u
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `500 ${26 * u}px ${scene.font}`
  ctx.fillText(scene.labels.elapsed, side, footer)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${96 * u}px ${scene.font}`
  ctx.fillText(formatClock(Math.min(seconds, scene.maxSeconds)), side, footer + 80 * u)
  ctx.textAlign = 'right'
  ctx.font = `600 ${36 * u}px ${scene.font}`
  // A count, not a status: ink, never the accent.
  ctx.fillStyle = '#ffffff'
  const finished = scene.runs.length - running
  ctx.fillText(running > 0 ? scene.labels.running(running, scene.runs.length) : scene.labels.finished(finished), w - side, footer + 80 * u)

  const all = finishBins(scene.runs.map((r) => r.duration), Infinity, BIN_SECONDS, scene.binCount)
  const done = finishBins(scene.runs.map((r) => r.duration), seconds, BIN_SECONDS, scene.binCount)
  const peak = Math.max(1, ...all)
  const histTop = footer + 130 * u
  const histH = 150 * u
  const gap = 8 * u
  const barW = (w - side * 2 - gap * (scene.binCount - 1)) / scene.binCount
  for (let i = 0; i < scene.binCount; i++) {
    const x = side + i * (barW + gap)
    const whole = (all[i]! / peak) * histH
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(x, histTop + histH - whole, barW, whole)
    const fill = (done[i]! / peak) * histH
    ctx.fillStyle = rgbCss(accent)
    ctx.fillRect(x, histTop + histH - fill, barW, fill)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `500 ${26 * u}px ${scene.font}`
  ctx.textAlign = 'left'
  ctx.fillText('0:00', side, histTop + histH + 38 * u)
  ctx.textAlign = 'center'
  ctx.fillText(scene.labels.histogram, w / 2, histTop + histH + 38 * u)
  ctx.textAlign = 'right'
  const lastBin = scene.binCount * BIN_SECONDS
  ctx.fillText(`${formatClock(Math.min(lastBin, scene.maxSeconds)).replace(/:\d\d$/, '')}`, w - side, histTop + histH + 38 * u)
  ctx.restore()
}
