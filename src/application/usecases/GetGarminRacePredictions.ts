import { t } from '@/i18n'
import { getRacePredictionDays } from '@/infrastructure/repositories/JsonRacePredictionRepository'
import { RACE_DISTANCES, RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'

/**
 * Garmin's own finish-time estimates over time.
 *
 * Distinct from GetRacePredictions, which derives a single current estimate per
 * distance from our records via Riegel: this one is a daily series Firstbeat
 * recomputes from VO2max and recent training, so it answers "is my race
 * potential moving?" rather than "what would I run today?".
 */

export interface GarminRacePredictionPoint {
  date: string
  label: string
  /**
   * Predicted pace in sec/km per distance. Paces rather than finish times so
   * all four distances share one readable axis - a marathon estimate is eight
   * times a 5 km one, which would flatten the short distances into a line.
   */
  '5k': number | null
  '10k': number | null
  half: number | null
  marathon: number | null
}

export interface GarminRacePredictionTrend {
  distance: RaceDistanceKey
  /** Seconds taken off the predicted finish across the window; negative = slower. */
  improvementSec: number
  currentSec: number
}

export interface GarminRacePredictionsData {
  points: GarminRacePredictionPoint[]
  /** Distances the watch actually predicted across the window. */
  distances: RaceDistanceKey[]
  /** Latest predicted finish time per distance, in seconds. */
  latest: Partial<Record<RaceDistanceKey, number>>
  /** Biggest movement over the window - the headline the chart explains. */
  bestTrend: GarminRacePredictionTrend | null
}

const WINDOW_DAYS = 180

export function bestTrend(
  points: GarminRacePredictionPoint[],
  distances: RaceDistanceKey[],
): GarminRacePredictionTrend | null {
  let best: GarminRacePredictionTrend | null = null

  for (const distance of distances) {
    const paces = points.map((p) => p[distance]).filter((v): v is number => v !== null)
    const first = paces[0]
    const last = paces[paces.length - 1]
    if (first === undefined || last === undefined || paces.length < 2) continue

    const km = RACE_DISTANCE_KM[distance]
    const trend: GarminRacePredictionTrend = {
      distance,
      improvementSec: Math.round((first - last) * km),
      currentSec: Math.round(last * km),
    }
    if (!best || trend.improvementSec > best.improvementSec) best = trend
  }

  return best
}

export function getGarminRacePredictions(): GarminRacePredictionsData | null {
  const days = getRacePredictionDays().slice(-WINDOW_DAYS)
  if (days.length < 2) return null

  const points: GarminRacePredictionPoint[] = days.map((day) => ({
    date: day.date,
    label: new Date(day.date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
    '5k': paceOf(day['5k'], '5k'),
    '10k': paceOf(day['10k'], '10k'),
    half: paceOf(day.half, 'half'),
    marathon: paceOf(day.marathon, 'marathon'),
  }))

  const distances = RACE_DISTANCES.filter((d) => points.some((p) => p[d] !== null))
  if (!distances.length) return null

  const lastDay = days[days.length - 1]!
  const latest: Partial<Record<RaceDistanceKey, number>> = {}
  for (const distance of distances) {
    const seconds = lastDay[distance]
    if (seconds !== undefined) latest[distance] = seconds
  }

  return { points, distances, latest, bestTrend: bestTrend(points, distances) }
}

function paceOf(seconds: number | undefined, distance: RaceDistanceKey): number | null {
  return seconds === undefined ? null : Math.round(seconds / RACE_DISTANCE_KM[distance])
}
