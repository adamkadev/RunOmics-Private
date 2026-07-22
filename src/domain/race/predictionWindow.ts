import { RACE_DISTANCE_KM, RACE_DISTANCES, type RaceDistanceKey } from './distances'
import type { ChartRange } from '../timeWindow'

export interface DatedPaces {
  date: string
  '5k': number | null
  '10k': number | null
  half: number | null
  marathon: number | null
}

function weekKey(date: string): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function downsamplePaces<T extends DatedPaces & { label: string }>(
  points: T[],
  range: ChartRange,
): (DatedPaces & { label: string })[] {
  if (points.length === 0) return []

  const keyOf = range === '4w' ? weekKey : (date: string) => date.slice(0, 7)

  const buckets = new Map<string, T[]>()
  for (const point of points) {
    const key = keyOf(point.date)
    const list = buckets.get(key) ?? []
    list.push(point)
    buckets.set(key, list)
  }

  return Array.from(buckets.keys())
    .sort()
    .map((key) => {
      const bucket = buckets.get(key)!
      const last = bucket[bucket.length - 1]!
      const averaged: DatedPaces & { label: string } = {
        date: last.date,
        label: last.label,
        '5k': null,
        '10k': null,
        half: null,
        marathon: null,
      }

      for (const distance of RACE_DISTANCES) {
        const values = bucket.map((p) => p[distance]).filter((v): v is number => v !== null)
        averaged[distance] = values.length
          ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
          : null
      }

      return averaged
    })
}

export interface PredictionTrend {
  distance: RaceDistanceKey
  improvementSec: number
  currentSec: number
}

/** Finish-time trend for one distance: positive improvementSec = getting faster,
 *  negative = slower, null when there isn't enough history to compare. */
export function paceTrend(points: DatedPaces[], distance: RaceDistanceKey): PredictionTrend | null {
  const paces = points.map((p) => p[distance]).filter((v): v is number => v !== null)
  const first = paces[0]
  const last = paces[paces.length - 1]
  if (first === undefined || last === undefined || paces.length < 2) return null

  const km = RACE_DISTANCE_KM[distance]
  return {
    distance,
    improvementSec: Math.round((first - last) * km),
    currentSec: Math.round(last * km),
  }
}

export function bestTrend(points: DatedPaces[], distances: RaceDistanceKey[]): PredictionTrend | null {
  let best: PredictionTrend | null = null

  for (const distance of distances) {
    const trend = paceTrend(points, distance)
    if (!trend) continue
    if (!best || trend.improvementSec > best.improvementSec) best = trend
  }

  return best
}
