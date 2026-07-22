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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

/** Uniform point budget per window, so every windowed numeric chart reads as
 *  a clean trend rather than a dense wall of daily values: twelve points for
 *  a year, six for six months, one per week for four weeks. */
export const TARGET_POINT_COUNT: Record<ChartRange, number> = {
  '4w': 4,
  '6m': 6,
  '1y': 12,
}

/**
 * Downsample a windowed points array to `TARGET_POINT_COUNT[range]` by
 * grouping into equal index-buckets and averaging each numeric field - these
 * are smoothed trend reads, not exact daily values. Non-numeric fields (date,
 * label, status, ...) come from the bucket's last point, so ticks and tooltips
 * stay meaningful. A no-op when there are already fewer points than the target.
 *
 * `decimals` defaults to 2 because the same series carry whole-number loads
 * (CTL ~50) and small fractional ones (stride length ~1.2 m, efficiency ~0.95);
 * rounding everything to an integer would flatten the fractional ones. Charts
 * whose values are only ever whole numbers pass 0.
 */
export function sampleForRange<T extends { date: string }>(
  points: T[],
  range: ChartRange,
  decimals = 2,
): T[] {
  const target = TARGET_POINT_COUNT[range]
  if (points.length <= target) return points

  const factor = 10 ** decimals
  const bucketSize = points.length / target
  const result: T[] = []
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
    result.push(sampled as T)
  }
  return result
}
