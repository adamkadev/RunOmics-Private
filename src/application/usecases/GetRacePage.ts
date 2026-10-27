import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { freshGarminPredictions, getGarminRacePredictions } from './GetGarminRacePredictions'
import { DISTANCE_KEY, getRecords } from './GetRecords'
import { RACE_DISTANCE_KM, isRaceDistanceKey, type RaceDistanceKey } from '@/domain/race/distances'
import type { PredictionPoint } from '@/domain/race/pacing'
import type { GoalYear, UpcomingRace } from '@/domain/goals/types'
import { officialResultsByActivityId } from '@/domain/activity/raceResult'
import { bestRecentEffort, secondsForVdot } from '@/domain/training/vdot'
import { DAY_MS, appTodayIso } from '@/lib/calendarDate'
import { forecastForm, type FormForecast } from '@/domain/training/formForecast'
import { athleteHrBounds, dailyTrimpByDate } from './GetTrainingLoad'
import { getPlannedWorkouts } from './GetPlannedWorkouts'

export const RACE_TREND_DAYS = 84
const ESTIMATE_STEP_DAYS = 7

/** What the estimate stands on when Garmin's predictions are missing or stale. */
export interface RaceEstimate {
  /** An EFFORTS key. */
  effort: string
  date: string
  vdot: number
}

export interface RacePageData {
  race: UpcomingRace
  distance: RaceDistanceKey
  distanceKm: number
  daysUntil: number
  predictedSeconds: number | null
  targetSeconds: number | null
  pb: { seconds: number; date: string | null } | null
  trend: PredictionPoint[]
  /** Set when the prediction and its trend are a VDOT estimate from the athlete's own efforts, not Garmin's. */
  estimate: RaceEstimate | null
  form: FormForecast
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
  if (race.justFinish) return null
  const year = Number(race.date.slice(0, 4))
  return goalYears.find((g) => g.year === year)?.targets.find((t) => t.distance === race.distance)?.targetSeconds ?? null
}

const daysBefore = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10)

/** Each week's VDOT estimate as it stood that day, so the line moves only when a better effort was run or one aged out. */
function estimatedTrend(distanceKm: number, today: string): { latest: number; estimate: RaceEstimate; trend: PredictionPoint[] } | null {
  const activities = getAllActivities()
  const official = officialResultsByActivityId(getOfficialRaceResults())
  const now = bestRecentEffort(activities, official, today)
  if (!now) return null
  const trend: PredictionPoint[] = []
  for (let days = RACE_TREND_DAYS; days > 0; days -= ESTIMATE_STEP_DAYS) {
    const date = daysBefore(today, days)
    const then = bestRecentEffort(activities, official, date)
    if (then) trend.push({ date, seconds: secondsForVdot(then.vdot, distanceKm) })
  }
  const latest = secondsForVdot(now.vdot, distanceKm)
  trend.push({ date: today, seconds: latest })
  return { latest, estimate: { effort: now.effort, date: now.date, vdot: Math.round(now.vdot * 10) / 10 }, trend }
}

async function raceDayForm(raceDate: string, today: string): Promise<FormForecast> {
  const activities = getAllActivities().filter((a) => a.date <= today)
  const planned = (await getPlannedWorkouts()).map((w) => ({ date: w.date, load: w.estimatedLoad ?? 0 }))
  return forecastForm({ dailyLoad: dailyTrimpByDate(activities, athleteHrBounds()), runDates: activities.map((a) => a.date), planned, today, raceDate })
}

export async function getRacePageData(today: string = appTodayIso()): Promise<RacePageData | null> {
  const race = nextKnownRace(getUpcomingRaceYears().flatMap((y) => y.races), today)
  const distance = race ? distanceOf(race) : null
  if (!race || !distance) return null

  const predictions = getGarminRacePredictions()
  const record = (await getRecords()).find((r) => r.key === distance)
  const garmin = freshGarminPredictions(predictions, today)[distance] ?? null
  const from = daysBefore(today, RACE_TREND_DAYS)
  const estimated = garmin === null ? estimatedTrend(RACE_DISTANCE_KM[distance], today) : null
  const trend = estimated?.trend ?? (predictions?.points ?? []).flatMap((p) => {
    const seconds = p.seconds[distance]
    return p.date >= from && seconds !== undefined ? [{ date: p.date, seconds }] : []
  })

  // As the Progress card reads it: a best faster than the prediction is a time already run.
  const latest = garmin ?? estimated?.latest ?? null
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
    estimate: estimated?.estimate ?? null,
    form: await raceDayForm(race.date, today),
  }
}
