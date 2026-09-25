import { RACE_DISTANCE_KM, type RaceDistanceKey } from './distances'

export interface DatedPaces {
  date: string
  '5k': number | null
  '10k': number | null
  half: number | null
  marathon: number | null
}

export interface PredictionTrend {
  distance: RaceDistanceKey
  improvementSec: number
  currentSec: number
}

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

/** Readings on or after the date `months` months before the latest one. */
export function trailingMonths<T extends { date: string }>(points: T[], months: number): T[] {
  const last = points[points.length - 1]
  if (!last) return []
  const [y, m, d] = last.date.split('-').map(Number) as [number, number, number]
  const from = new Date(Date.UTC(y, m - 1 - months, d)).toISOString().slice(0, 10)
  return points.filter((p) => p.date >= from)
}
