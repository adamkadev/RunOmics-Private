import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getGarminRacePredictions } from './GetGarminRacePredictions'
import { DISTANCE_KEY, getRecords } from './GetRecords'
import { RACE_DISTANCE_KM, isRaceDistanceKey, type RaceDistanceKey } from '@/domain/race/distances'
import type { PredictionPoint } from '@/domain/race/pacing'
import type { GoalYear, UpcomingRace } from '@/domain/goals/types'
import { DAY_MS, appTodayIso } from '@/lib/calendarDate'

export const RACE_TREND_DAYS = 84

export interface RacePageData {
  race: UpcomingRace
  distance: RaceDistanceKey
  distanceKm: number
  daysUntil: number
  predictedSeconds: number | null
  targetSeconds: number | null
  pb: { seconds: number; date: string | null } | null
  trend: PredictionPoint[]
}

function distanceOf(race: UpcomingRace): RaceDistanceKey | null {
  const key = DISTANCE_KEY[race.distance]
  return key && isRaceDistanceKey(key) ? key : null
}

export function nextKnownRace(races: readonly UpcomingRace[], today: string): UpcomingRace | null {
  return [...races].filter((r) => r.date >= today && distanceOf(r) !== null).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

/** The race's own target first, else the season's for that distance. */
export function raceTarget(race: UpcomingRace, goalYears: readonly GoalYear[]): number | null {
  if (race.targetSeconds) return race.targetSeconds
  const year = Number(race.date.slice(0, 4))
  return goalYears.find((g) => g.year === year)?.targets.find((t) => t.distance === race.distance)?.targetSeconds ?? null
}

export async function getRacePageData(today: string = appTodayIso()): Promise<RacePageData | null> {
  const race = nextKnownRace(getUpcomingRaceYears().flatMap((y) => y.races), today)
  const distance = race ? distanceOf(race) : null
  if (!race || !distance) return null

  const predictions = getGarminRacePredictions()
  const record = (await getRecords()).find((r) => r.key === distance)
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - RACE_TREND_DAYS * DAY_MS).toISOString().slice(0, 10)
  const trend = (predictions?.points ?? []).flatMap((p) => {
    const seconds = p.seconds[distance]
    return p.date >= from && seconds !== undefined ? [{ date: p.date, seconds }] : []
  })

  // As the Progress card reads it: a best faster than Garmin's prediction is a time already run.
  const latest = predictions?.latest[distance] ?? null
  const best = record?.seconds ?? null
  return {
    race,
    distance,
    distanceKm: RACE_DISTANCE_KM[distance],
    daysUntil: Math.round((Date.parse(`${race.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS),
    predictedSeconds: latest !== null && best !== null ? Math.min(latest, best) : latest,
    targetSeconds: raceTarget(race, getGoalYears()),
    pb: best ? { seconds: best, date: record?.date ?? null } : null,
    trend,
  }
}
