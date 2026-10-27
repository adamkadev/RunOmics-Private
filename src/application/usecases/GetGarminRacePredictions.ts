import { getRacePredictionDays } from '@/infrastructure/repositories/JsonRacePredictionRepository'
import { RACE_DISTANCES, RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'
import type { DatedPaces } from '@/domain/race/predictionWindow'
import { isCurrentGarminReading } from '@/domain/sync/garminReadings'
import { AXIS_TICK_DATE, formatDate } from '@/lib/formatters'

export interface GarminRacePredictionPoint extends DatedPaces {
  date: string
  label: string
  '5k': number | null
  '10k': number | null
  half: number | null
  marathon: number | null
  /** The predicted times themselves, which the paces above are worked out from. */
  seconds: Partial<Record<RaceDistanceKey, number>>
}

export interface GarminRacePredictionsData {
  points: GarminRacePredictionPoint[]
  distances: RaceDistanceKey[]
  latest: Partial<Record<RaceDistanceKey, number>>
  latestDate: string | null
}

const MAX_DAYS = 1095

export function getGarminRacePredictions(): GarminRacePredictionsData | null {
  const days = getRacePredictionDays().slice(-MAX_DAYS)
  if (days.length < 2) return null

  const points: GarminRacePredictionPoint[] = days.map((day) => ({
    date: day.date,
    label: formatDate(day.date, AXIS_TICK_DATE),
    '5k': paceOf(day['5k'], '5k'),
    '10k': paceOf(day['10k'], '10k'),
    half: paceOf(day.half, 'half'),
    marathon: paceOf(day.marathon, 'marathon'),
    seconds: Object.fromEntries(RACE_DISTANCES.flatMap((d) => (day[d] !== undefined ? [[d, day[d]]] : []))),
  }))

  const distances = RACE_DISTANCES.filter((d) => points.some((p) => p[d] !== null))
  if (!distances.length) return null

  const lastDay = days[days.length - 1]!
  const latest: Partial<Record<RaceDistanceKey, number>> = {}
  for (const distance of distances) {
    const seconds = lastDay[distance]
    if (seconds !== undefined) latest[distance] = seconds
  }

  return { points, distances, latest, latestDate: lastDay.date }
}

/** Garmin's latest predictions, or none once the series has gone quiet. */
export function freshGarminPredictions(predictions: GarminRacePredictionsData | null, today: string): Partial<Record<RaceDistanceKey, number>> {
  return predictions && isCurrentGarminReading('racePrediction', predictions.latestDate, today) ? predictions.latest : {}
}

function paceOf(seconds: number | undefined, distance: RaceDistanceKey): number | null {
  return seconds === undefined ? null : Math.round(seconds / RACE_DISTANCE_KM[distance])
}
