import { isoDate } from '@/lib/calendarDate'

export type ChartRange = '4w' | '6m' | '1y'

export const CHART_RANGES: ChartRange[] = ['4w', '6m', '1y']

export const RANGE_DAYS: Record<ChartRange, number> = {
  '4w': 28,
  '6m': 183,
  '1y': 365,
}

export interface WindowBounds {
  from: string
  to: string
}

export function windowBounds(range: ChartRange, offset: number, anchor: Date): WindowBounds {
  const days = RANGE_DAYS[range]
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  end.setDate(end.getDate() - offset * days)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))

  return { from: isoDate(start), to: isoDate(end) }
}

export function pointsInWindow<T extends { date: string }>(points: T[], bounds: WindowBounds): T[] {
  return points.filter((p) => p.date >= bounds.from && p.date <= bounds.to)
}

export function hasEarlierPoints(points: { date: string }[], bounds: WindowBounds): boolean {
  return points.some((p) => p.date < bounds.from)
}

export const TARGET_POINT_COUNT: Record<ChartRange, number> = {
  '4w': 4,
  '6m': 6,
  '1y': 12,
}

export function sampleForRange<T extends { date: string }>(
  points: T[],
  range: ChartRange,
  decimals = 2,
): T[] {
  const target = TARGET_POINT_COUNT[range]
  if (points.length <= target) return points

  const factor = 10 ** decimals
  const bucketSize = points.length / target
  const downsampled: T[] = []
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucketSize)
    const end = i === target - 1 ? points.length : Math.floor((i + 1) * bucketSize)
    const bucket = points.slice(start, end)
    if (bucket.length === 0) continue
    const last = bucket[bucket.length - 1] as T
    const sampled: Record<string, unknown> = { ...last }
    for (const key of Object.keys(last as object)) {
      const values = bucket
        .map((p) => (p as Record<string, unknown>)[key])
        .filter((v): v is number => typeof v === 'number')
      if (values.length > 0) {
        sampled[key] = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * factor) / factor
      }
    }
    downsampled.push(sampled as T)
  }
  return downsampled
}

export const SPARSE_SERIES_MAX = 6
export const MIN_CURVE_POINTS = 3

export type SeriesShape = 'curve' | 'sparse' | 'tooFew'

export function seriesShape(count: number): SeriesShape {
  if (count < MIN_CURVE_POINTS) return 'tooFew'
  return count <= SPARSE_SERIES_MAX ? 'sparse' : 'curve'
}

export function lineInterpolation(count: number): 'monotone' | 'linear' {
  return seriesShape(count) === 'curve' ? 'monotone' : 'linear'
}

export function seriesCadence(points: { date: string }[]): 'weekly' | 'daily' | null {
  if (points.length < 2) return null

  const gaps: number[] = []
  for (let i = 1; i < points.length; i++) {
    const a = Date.parse(points[i - 1]!.date + 'T00:00:00Z')
    const b = Date.parse(points[i]!.date + 'T00:00:00Z')
    gaps.push(Math.round((b - a) / 86_400_000))
  }
  gaps.sort((x, y) => x - y)
  const median = gaps[Math.floor(gaps.length / 2)]!

  if (median >= 5) return 'weekly'
  return median <= 2 ? 'daily' : null
}

export const PLOT_STRIDE_DAYS: Record<ChartRange, number> = {
  '4w': 1,
  '6m': 7,
  '1y': 7,
}

export function pickForRange<T extends { date: string }>(points: T[], range: ChartRange): T[] {
  const stride = PLOT_STRIDE_DAYS[range]
  if (stride <= 1) return points

  const offset = (points.length - 1) % stride
  return points.filter((_, i) => i % stride === offset)
}

const MAX_AXIS_LABELS = 7

export function monthStartTicks<T extends { date: string }>(
  points: T[],
  max = MAX_AXIS_LABELS
): Set<string> {
  const starts: string[] = []
  let seen = ''
  for (const point of points) {
    const month = point.date.slice(0, 7)
    if (month !== seen) {
      starts.push(point.date)
      seen = month
    }
  }

  const step = Math.ceil(starts.length / max)
  return new Set(starts.filter((_, i) => i % step === 0))
}

const WEEK_MS = 7 * 86_400_000

export function fillWeeklyGaps<T extends { date: string }>(
  points: T[],
  blank: (monday: string) => T
): T[] {
  const filled: T[] = []

  for (const [i, point] of points.entries()) {
    const previous = points[i - 1]
    if (previous) {
      let cursor = Date.parse(previous.date + 'T00:00:00Z') + WEEK_MS
      const until = Date.parse(point.date + 'T00:00:00Z')
      while (cursor < until) {
        filled.push(blank(new Date(cursor).toISOString().slice(0, 10)))
        cursor += WEEK_MS
      }
    }
    filled.push(point)
  }

  return filled
}
