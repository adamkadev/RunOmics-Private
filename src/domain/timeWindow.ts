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

/**
 * How many X-axis labels a phone-width chart card can carry before they start
 * colliding: the plot is ~270px wide inside the card, and a short month label
 * ("juil.") is ~30px at the 11px tick size.
 */
const MAX_AXIS_LABELS = 7

/**
 * The first point of each month, thinned so at most `max` render - the tick
 * dates for a window wide enough that individual days stop meaning anything.
 *
 * Spacing ticks evenly through the array instead (see windowTicks) lands them
 * on whatever week happens to fall there, so a year reads "4 Aug · 29 Sep ·
 * 24 Nov" - dates that mark nothing and cannot be scanned as a calendar. Month
 * starts are the landmarks the eye is looking for.
 */
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

/**
 * Weeks in which nothing was run are absent from a weekly series - there was no
 * activity to aggregate - so a categorical axis draws a three-week break as a
 * single step and the curve joins across it as if training never stopped. Fill
 * those gaps with explicit blank weeks: for a volume chart a week at 0 km is a
 * reading, not a missing value, and it is usually the most informative one on
 * the chart.
 *
 * Only the interior is filled. Before the first week there is no history to
 * claim, and after the last one there is nothing recorded yet.
 */
export function fillWeeklyGaps<T extends { date: string }>(
  points: T[],
  blank: (monday: string) => T
): T[] {
  const out: T[] = []

  for (const [i, point] of points.entries()) {
    const previous = points[i - 1]
    if (previous) {
      let cursor = Date.parse(previous.date + 'T00:00:00Z') + WEEK_MS
      const until = Date.parse(point.date + 'T00:00:00Z')
      while (cursor < until) {
        out.push(blank(new Date(cursor).toISOString().slice(0, 10)))
        cursor += WEEK_MS
      }
    }
    out.push(point)
  }

  return out
}
