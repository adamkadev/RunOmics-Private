import { t } from '@/i18n'
import { getRacePredictionDays } from '@/infrastructure/repositories/JsonRacePredictionRepository'
import { RACE_DISTANCES, RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'
import type { DatedPaces } from '@/domain/race/predictionWindow'

export interface GarminRacePredictionPoint extends DatedPaces {
  date: string
  label: string
  '5k': number | null
  '10k': number | null
  half: number | null
  marathon: number | null
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

  return { points, distances, latest, latestDate: lastDay.date }
}

function paceOf(seconds: number | undefined, distance: RaceDistanceKey): number | null {
  return seconds === undefined ? null : Math.round(seconds / RACE_DISTANCE_KM[distance])
}
