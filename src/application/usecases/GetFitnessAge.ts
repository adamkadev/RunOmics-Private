import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getFitnessAgeSamples, type FitnessAgeSample } from '@/infrastructure/repositories/JsonFitnessAgeRepository'
import { addDays, appTodayIso, isoDate, startOfWeek } from '@/lib/calendarDate'

export interface FitnessAgeView {
  /** In years, to one decimal. */
  now: number
  age: number | null
  /** The watch's achievable fitness age, only while it is still ahead of the current one. */
  achievable: number | null
  /** The last year, one reading a week, oldest first; empty under two. */
  trend: FitnessAgeSample[]
}

const TREND_DAYS = 365

const day = (iso: string) => new Date(`${iso}T00:00:00`)

export function getFitnessAge(today: string = appTodayIso()): FitnessAgeView | null {
  const athlete = getAthleteProfile()
  const since = isoDate(addDays(day(today), -TREND_DAYS))
  const samples = getFitnessAgeSamples().filter((s) => s.date > since && s.date <= today)
  const now = athlete.fitnessAgeYrs ?? samples.at(-1)?.years
  if (now === undefined) return null
  const byWeek = new Map<string, FitnessAgeSample>()
  for (const sample of samples) byWeek.set(isoDate(startOfWeek(day(sample.date))), sample)
  const trend = [...byWeek.values()]
  const achievable = athlete.achievableFitnessAgeYrs
  return {
    now,
    age: athlete.age ?? null,
    // Garmin still sends one once the athlete is younger than it, which would read as a step back.
    achievable: achievable !== undefined && Math.round(achievable) < Math.round(now) ? achievable : null,
    trend: trend.length >= 2 ? trend : [],
  }
}
