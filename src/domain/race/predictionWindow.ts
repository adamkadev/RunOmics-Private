import { RACE_DISTANCE_KM, type RaceDistanceKey } from './distances'

/**
 * Windowing and trend maths for the race predictor, kept in the domain so the
 * chart can page through ranges client-side without pulling the fs-backed
 * repository into the browser bundle.
 */

export type PredictionRange = '4w' | '6m' | '1y'

export const PREDICTION_RANGES: PredictionRange[] = ['4w', '6m', '1y']

export const RANGE_DAYS: Record<PredictionRange, number> = {
  '4w': 28,
  '6m': 183,
  '1y': 365,
}

/** Minimal shape the window helpers need - the chart's point type satisfies it. */
export interface DatedPaces {
  date: string
  '5k': number | null
  '10k': number | null
  half: number | null
  marathon: number | null
}

export interface WindowBounds {
  from: string
  to: string
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Bounds of the window `offset` steps back from today, both ends inclusive.
 *
 * Offset 0 is the window ending today; 1 is the equally long one before it, and
 * so on, so stepping back never overlaps or skips a day.
 */
export function windowBounds(range: PredictionRange, offset: number, today: Date): WindowBounds {
  const days = RANGE_DAYS[range]
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  end.setDate(end.getDate() - offset * days)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))

  return { from: isoDate(start), to: isoDate(end) }
}

export function pointsInWindow<T extends { date: string }>(points: T[], bounds: WindowBounds): T[] {
  return points.filter((p) => p.date >= bounds.from && p.date <= bounds.to)
}

/** Whether any reading predates the window - i.e. the back arrow leads somewhere. */
export function hasEarlierPoints(points: { date: string }[], bounds: WindowBounds): boolean {
  return points.some((p) => p.date < bounds.from)
}

export interface PredictionTrend {
  distance: RaceDistanceKey
  /** Seconds taken off the predicted finish across the window; negative = slower. */
  improvementSec: number
  currentSec: number
}

/**
 * The distance that moved most across the window.
 *
 * Compared in finish-time seconds rather than pace seconds, so a marathon shift
 * is not flattened against a 5 km one.
 */
export function bestTrend(points: DatedPaces[], distances: RaceDistanceKey[]): PredictionTrend | null {
  let best: PredictionTrend | null = null

  for (const distance of distances) {
    const paces = points.map((p) => p[distance]).filter((v): v is number => v !== null)
    const first = paces[0]
    const last = paces[paces.length - 1]
    if (first === undefined || last === undefined || paces.length < 2) continue

    const km = RACE_DISTANCE_KM[distance]
    const trend: PredictionTrend = {
      distance,
      improvementSec: Math.round((first - last) * km),
      currentSec: Math.round(last * km),
    }
    if (!best || trend.improvementSec > best.improvementSec) best = trend
  }

  return best
}
