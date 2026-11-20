import type { ShareActivity } from '@/lib/shareCardStats'

export const TRACE_POINTS = 90
const MIN_HR_SPAN = 40
/** Past the five zones: a stride on the heart-rate trace. */
export const STRIDE_TAG = 6
const MIN_SAMPLES = 20

export interface TracePoint {
  /** 0 at the start, 1 at the finish. */
  x: number
  /** 0 at the top. */
  y: number
  /** The heart-rate zone the point sits in, Z1 drawn as Z2, or STRIDE_TAG; on a pace trace, 1 in a rep and 0 out. */
  tag: number
}

export interface ShareTrace {
  kind: 'hr' | 'pace'
  points: TracePoint[]
  /** The target pace's band, top and bottom on the same scale. */
  band: [number, number] | null
  avgHr: number | null
  /** The reps on a heart-rate trace, as shares of its width. */
  shade: [number, number][]
}

function valid(samples: readonly number[] | null | undefined): number[] | null {
  if (!samples) return null
  return samples.filter((v) => Number.isFinite(v) && v > 0).length >= MIN_SAMPLES ? [...samples] : null
}

function quantile(sorted: readonly number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!
}

/** Bucket means, so a 1 s spike or a dropout does not draw a needle. */
interface Bucket {
  value: number
  peak: number
  from: number
  to: number
}

function buckets(samples: readonly number[], count: number): Bucket[] {
  const n = samples.length
  const size = Math.max(1, n / count)
  const out: Bucket[] = []
  for (let start = 0; start < n; start += size) {
    const from = Math.floor(start)
    const to = Math.min(n, Math.floor(start + size))
    const values = samples.slice(from, Math.max(to, from + 1)).filter((v) => Number.isFinite(v) && v > 0)
    if (values.length) out.push({ value: values.reduce((a, b) => a + b, 0) / values.length, peak: Math.max(...values), from, to })
  }
  return out
}

/** Each sample spans the same time, so its distance is that time over its pace. */
function distanceShares(paces: readonly number[]): number[] {
  const step = paces.map((p) => (p > 0 ? 1 / p : 0))
  const total = step.reduce((a, b) => a + b, 0)
  if (total <= 0) return paces.map((_, i) => i / Math.max(1, paces.length - 1))
  let at = 0
  return step.map((s) => {
    at += s
    return (at - s / 2) / total
  })
}

/** By the floors alone: the synced zones carry no ceiling. */
function zoneOf(bpm: number, zones: ShareActivity['hrZones']): number {
  const reached = zones.filter((z) => bpm >= z.minBpm).reduce((top, z) => Math.max(top, z.zone), 0)
  return Math.max(2, reached)
}

/** Each heart-rate sample's share of the distance, by the pace sampled with it when there is one. */
function sampleShares(activity: ShareActivity, n: number): number[] {
  const paces = valid(activity.paceSamples)
  return paces?.length === n ? distanceShares(paces) : Array.from({ length: n }, (_, i) => i / Math.max(1, n - 1))
}

const REP_ZONES = new WeakMap<ShareActivity, number | null>()

/** The zone the reps' heart rate spent most of its time in, read against the athlete's own synced zones. */
export function repZone(activity: ShareActivity): number | null {
  if (REP_ZONES.has(activity)) return REP_ZONES.get(activity)!
  const hr = valid(activity.hrSamples)
  const windows = activity.reps?.windows ?? activity.repWindows ?? []
  let zone: number | null = null
  if (hr && windows.length && activity.hrZones.length) {
    const shares = sampleShares(activity, hr.length)
    const counts = new Map<number, number>()
    hr.forEach((bpm, i) => {
      if (bpm > 0 && windows.some(([a, b]) => shares[i]! >= a && shares[i]! <= b)) {
        const z = zoneOf(bpm, activity.hrZones)
        counts.set(z, (counts.get(z) ?? 0) + 1)
      }
    })
    const [top] = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])
    zone = top && top[0] >= 3 ? top[0] : null
  }
  REP_ZONES.set(activity, zone)
  return zone
}

function spread(points: TracePoint[]): TracePoint[] {
  return points.map((p, i) => ({ ...p, x: points.length > 1 ? i / (points.length - 1) : 0 }))
}

function scale(value: number, lo: number, hi: number, invert: boolean): number {
  const share = Math.min(1, Math.max(0, (value - lo) / (hi - lo || 1)))
  return invert ? share : 1 - share
}

function paceTrace(activity: ShareActivity, paces: number[]): ShareTrace {
  const reps = activity.reps?.windows.length ? activity.reps : null
  const shares = distanceShares(paces)
  const sorted = paces.filter((v) => v > 0).sort((a, b) => a - b)
  const target = reps?.target ?? null
  // Stops and walks run off the slow end: the scale stops at the 90th percentile.
  let lo = quantile(sorted, 0.02)
  let hi = quantile(sorted, 0.9)
  if (target) {
    lo = Math.min(lo, target.min - 5)
    hi = Math.max(hi, target.max + 5)
  }
  const pad = (hi - lo) * 0.08
  lo -= pad
  hi += pad
  const n = paces.length
  const points = buckets(paces, TRACE_POINTS).map(({ value, from, to }) => {
    const mid = shares[Math.min(n - 1, Math.floor((from + to) / 2))]!
    const inRep = reps?.windows.some(([a, b]) => mid >= a && mid <= b) ?? false
    return { x: (from + to) / 2 / n, y: scale(value, lo, hi, true), tag: inRep ? 1 : 0 }
  })
  const band: [number, number] | null = target ? [scale(target.min, lo, hi, true), scale(target.max, lo, hi, true)] : null
  return { kind: 'pace', points: spread(points), band, avgHr: null, shade: [] }
}

function hrTrace(activity: ShareActivity, hr: number[]): ShareTrace {
  const sorted = hr.filter((v) => v > 0).sort((a, b) => a - b)
  const low = quantile(sorted, 0.02) - 4
  const high = quantile(sorted, 1) + 4
  // A steady run's 20 bpm stretched to the full height would read as spikes.
  const span = Math.max(MIN_HR_SPAN, high - low)
  const lo = (low + high - span) / 2
  const hi = lo + span
  const n = hr.length
  const shares = sampleShares(activity, n)
  const strides = activity.reps?.windows.length ? [] : (activity.strides?.windows ?? [])
  const inStride = (from: number, to: number) =>
    strides.some(([a, b]) => shares[Math.max(from, to - 1)]! >= a && shares[from]! <= b)
  // A stride by its peak: averaged into a 40 s bucket, 20 s of it barely lifts the line.
  const points = buckets(hr, TRACE_POINTS).map(({ value, peak, from, to }) => {
    const stride = inStride(from, to)
    return {
      x: (from + to) / 2 / n,
      y: scale(stride ? peak : value, lo, hi, false),
      tag: stride ? STRIDE_TAG : zoneOf(peak, activity.hrZones),
    }
  })
  const at = (share: number) => {
    const i = shares.findIndex((s) => s >= share)
    return (i < 0 ? n - 1 : i) / Math.max(1, n - 1)
  }
  const reps = activity.reps?.windows ?? activity.repWindows ?? []
  const shade = reps.map(([a, b]): [number, number] => [at(a), at(b)])
  return { kind: 'hr', points: spread(points), band: null, avgHr: activity.avgHeartRate, shade }
}

/** An interval session's pace shows its reps against the target; any other run's heart rate shows its zones. */
export function shareTrace(activity: ShareActivity): ShareTrace | null {
  const paces = valid(activity.paceSamples)
  const hr = valid(activity.hrSamples)
  if (paces && activity.reps?.windows.length) return paceTrace(activity, paces)
  if (hr && activity.hrZones.length) return hrTrace(activity, hr)
  if (paces) return paceTrace(activity, paces)
  return null
}
