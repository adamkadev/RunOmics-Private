import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getLatestVO2max } from './GetVO2maxHistory'
import { round } from '@/lib/math'

const DAY_MS = 86_400_000
const YEAR_DAYS = 365.25

export type ExperienceLevel = 'beginner' | 'intermediate' | 'experienced' | 'veteran'

export interface RunnerProfileData {
  firstActivityDate: string
  yearsTracked: number
  totalDistanceKm: number
  totalActivities: number
  vo2max: number | null
  experienceLevel: ExperienceLevel
}

const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'experienced', 'veteran']

function tierFromYears(years: number): number {
  if (years < 1) return 0
  if (years < 3) return 1
  if (years < 7) return 2
  return 3
}

function tierFromKm(km: number): number {
  if (km < 500) return 0
  if (km < 2000) return 1
  if (km < 6000) return 2
  return 3
}

// Experience level is bounded by the weaker of the two signals: a high lifetime
// distance logged over a few months doesn't make someone a "veteran" yet, and
// years of sparse running doesn't make someone "experienced" in training-load terms.
export function getRunnerProfile(): RunnerProfileData | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const firstActivityDate = activities.reduce((min, a) => (a.date < min ? a.date : min), activities[0].date)
  const latestDate = activities.reduce((max, a) => (a.date > max ? a.date : max), activities[0].date)
  const yearsTracked = round(
    (new Date(latestDate + 'T00:00:00').getTime() - new Date(firstActivityDate + 'T00:00:00').getTime()) /
      (YEAR_DAYS * DAY_MS),
    1,
  )
  const totalDistanceKm = round(activities.reduce((s, a) => s + a.distanceKm, 0), 1)
  const tier = Math.min(tierFromYears(yearsTracked), tierFromKm(totalDistanceKm))

  return {
    firstActivityDate,
    yearsTracked,
    totalDistanceKm,
    totalActivities: activities.length,
    vo2max: getLatestVO2max(),
    experienceLevel: LEVELS[tier],
  }
}
