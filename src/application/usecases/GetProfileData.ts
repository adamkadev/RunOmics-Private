import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile, type AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getRecords, type RecordEntry } from '@/application/usecases/GetRecords'
import { getShoeStats, type ShoeStats } from '@/application/usecases/GetShoeStats'
import { computeProjection, type GoalYear, type GoalProjection } from '@/application/usecases/GetGoalsData'
import { getAthleteRank, type AthleteRank } from '@/application/usecases/GetAthleteRank'
import { sumDistanceKm, yearDistanceKm } from '@/domain/activity/distance'
import { round } from '@/lib/math'

const PROFILE_RECORD_KEYS = ['5k', '10k', 'half', 'marathon']

export interface ProfileHero {
  sinceDate: string | null
  lifetimeActivities: number
  lifetimeDistanceKm: number
  rank: AthleteRank | null
}

/** Same six headline stats, computed over any date window (this year, all time). */
export interface ProfilePeriodStats {
  distanceKm: number
  durationSeconds: number
  sessionCount: number
  elevationGainM: number
  avgKmPerWeek: number
  calories: number
}

export interface ProfileGoal {
  goalYear: GoalYear
  totalDistanceKm: number
  projection: GoalProjection | null
}

export interface ProfileData {
  hero: ProfileHero
  ytd: ProfilePeriodStats
  allTime: ProfilePeriodStats
  records: RecordEntry[]
  shoes: ShoeStats[]
  goal: ProfileGoal | null
  athlete: AthleteProfile
}

type StatsActivity = {
  distanceKm: number
  durationSeconds: number
  elevationGain?: number | null
  calories?: number | null
}

// `distanceKm` comes in pre-rounded from the shared whole-km selector so the
// card can't disagree with Goals/Analytics; `elapsedDays` is what turns the
// total into a rate (season-to-date for the year, full history for all time).
function periodStats(
  activities: ReadonlyArray<StatsActivity>,
  distanceKm: number,
  elapsedDays: number,
): ProfilePeriodStats {
  return {
    distanceKm,
    durationSeconds: activities.reduce((s, a) => s + a.durationSeconds, 0),
    sessionCount: activities.length,
    elevationGainM: Math.round(activities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)),
    avgKmPerWeek: round((distanceKm / elapsedDays) * 7),
    calories: activities.reduce((s, a) => s + (a.calories ?? 0), 0),
  }
}

export async function getProfileData(): Promise<ProfileData> {
  const activities = getAllActivities()
  const lifetime = getLifetimeStats()
  const allRecords = await getRecords()
  const goalYears = getGoalYears()
  const athlete = getAthleteProfile()

  const firstActivity = activities[0]
  const sinceDate = firstActivity
    ? activities.reduce((min, a) => (a.date < min ? a.date : min), firstActivity.date)
    : null

  const now = new Date()
  const currentYear = now.getFullYear()
  // Days elapsed since Jan 1, so "avg / week" is the season's real rate rather
  // than a year-to-date total spread over 52 weeks.
  const elapsedDaysThisYear = Math.max(
    1,
    Math.floor((now.getTime() - new Date(currentYear, 0, 1).getTime()) / 86400000) + 1,
  )
  const ytdActivities = activities.filter((a) => a.date.startsWith(String(currentYear)))
  const ytdDistanceKm = ytdActivities.reduce((s, a) => s + a.distanceKm, 0)
  // Shared selector so Progress/Goals/Analytics show the exact same whole-km total.
  const ytdDistanceKmRounded = yearDistanceKm(activities, currentYear)

  // All-time rates run from the very first logged activity, not from Jan 1.
  const elapsedDaysAllTime = Math.max(
    1,
    sinceDate
      ? Math.floor((now.getTime() - new Date(sinceDate + 'T00:00:00').getTime()) / 86400000) + 1
      : 1,
  )

  const goalYear = goalYears.find((g) => g.year === currentYear) ?? null
  const goal: ProfileGoal | null = goalYear
    ? {
        goalYear,
        totalDistanceKm: ytdDistanceKmRounded,
        projection: computeProjection(activities, currentYear, ytdDistanceKm, goalYear),
      }
    : null

  return {
    hero: {
      sinceDate,
      lifetimeActivities: lifetime?.totalActivities ?? 0,
      lifetimeDistanceKm: lifetime ? round(lifetime.totalDistanceKm, 0) : 0,
      rank: getAthleteRank(allRecords, athlete),
    },
    ytd: periodStats(ytdActivities, ytdDistanceKmRounded, elapsedDaysThisYear),
    allTime: periodStats(activities, sumDistanceKm(activities), elapsedDaysAllTime),
    records: PROFILE_RECORD_KEYS.map((key) => allRecords.find((r) => r.key === key)).filter(
      (r): r is RecordEntry => r !== undefined
    ),
    shoes: getShoeStats().filter((s) => !s.retired),
    goal,
    athlete,
  }
}
