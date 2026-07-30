import { getNextRace } from './GetNextRace'
import { getTrainingLoad } from './GetTrainingLoad'
import { getRacePredictions } from './GetRacePredictions'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { trimp, DEFAULT_HR_BOUNDS, type HrBounds } from '@/domain/training/trimp'
import { formVerdict, projectLoad, racePhase, type FormVerdict, type RacePhase } from '@/domain/training/taper'
import { DISTANCE_KEY } from '@/domain/activity/effort'
import type { UpcomingRace } from './GetGoalsData'
import { addDays, isoDate } from '@/lib/calendarDate'
import { round } from '@/lib/math'

export interface RaceReadiness {
  race: UpcomingRace
  daysUntil: number
  phase: RacePhase
  ctl: number
  tsb: number
  /** Form on race day if the recent daily load simply carried on. */
  projectedTsb: number
  projectedVerdict: FormVerdict
  predictedSeconds: number | null
  targetPaceSecPerKm: number | null
}

// The window whose daily load is carried forward. Long enough to average out a
// rest day, short enough to still be "what training looks like right now".
const RECENT_LOAD_DAYS = 14

export function recentDailyLoad(
  activities: { date: string; avgHeartRate: number | null; durationSeconds: number }[],
  today: Date,
  hrBounds: HrBounds = DEFAULT_HR_BOUNDS,
): number {
  const since = isoDate(addDays(today, -RECENT_LOAD_DAYS))
  const total = activities
    .filter((a) => a.date.slice(0, 10) > since)
    .reduce((sum, a) => sum + trimp(a, hrBounds), 0)
  return total / RECENT_LOAD_DAYS
}

export function daysBetween(from: Date, toIso: string): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const [y, m, d] = toIso.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - start) / 86_400_000)
}

/**
 * What the next race asks of today's training: how far out it is, the form the
 * current load would leave on the start line, and the time that form predicts.
 */
export async function getRaceReadiness(now = new Date()): Promise<RaceReadiness | null> {
  const race = await getNextRace()
  const load = await getTrainingLoad()
  if (!race || !load) return null

  const daysUntil = daysBetween(now, race.date)
  if (daysUntil < 0) return null

  const athlete = getAthleteProfile()
  const hrBounds: HrBounds = {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  }

  const dailyLoad = recentDailyLoad(getAllActivities(), now, hrBounds)
  const projected = projectLoad({ ctl: load.ctl, atl: load.atl, tsb: load.tsb }, dailyLoad, daysUntil)

  const prediction = (await getRacePredictions()).find((p) => p.key === DISTANCE_KEY[race.distance])

  return {
    race,
    daysUntil,
    phase: racePhase(daysUntil),
    ctl: load.ctl,
    tsb: load.tsb,
    projectedTsb: projected.tsb,
    projectedVerdict: formVerdict(projected.tsb),
    predictedSeconds: prediction?.predictedSeconds ?? null,
    targetPaceSecPerKm: prediction ? round(prediction.predictedSeconds / prediction.km) : null,
  }
}
