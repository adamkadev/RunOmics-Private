import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile, type AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getRecords, type RecordEntry } from '@/application/usecases/GetRecords'
import { getShoeStats, type ShoeStats } from '@/application/usecases/GetShoeStats'
import { computeProjection, type GoalYear, type GoalProjection } from '@/application/usecases/GetGoalsData'
import { getAthleteRank, type AthleteRank } from '@/application/usecases/GetAthleteRank'
import { yearDistanceKm } from '@/domain/activity/distance'
import { round } from '@/lib/math'

const PROFILE_RECORD_KEYS = ['5k', '10k', 'half', 'marathon']

export interface ProfileHero {
  sinceDate: string | null
  lifetimeActivities: number
  lifetimeDistanceKm: number
  rank: AthleteRank | null
}

export interface ProfileYtdStats {
  distanceKm: number
  durationSeconds: number
  sessionCount: number
  elevationGainM: number
}

export interface ProfileGoal {
  goalYear: GoalYear
  totalDistanceKm: number
  projection: GoalProjection | null
}

export interface ProfileData {
  hero: ProfileHero
  ytd: ProfileYtdStats
  records: RecordEntry[]
  shoes: ShoeStats[]
  goal: ProfileGoal | null
  athlete: AthleteProfile
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

  const currentYear = new Date().getFullYear()
  const ytdActivities = activities.filter((a) => a.date.startsWith(String(currentYear)))
  const ytdDistanceKm = ytdActivities.reduce((s, a) => s + a.distanceKm, 0)
  // Shared selector so Progress/Goals/Analytics show the exact same whole-km total.
  const ytdDistanceKmRounded = yearDistanceKm(activities, currentYear)

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
    ytd: {
      distanceKm: ytdDistanceKmRounded,
      durationSeconds: ytdActivities.reduce((s, a) => s + a.durationSeconds, 0),
      sessionCount: ytdActivities.length,
      elevationGainM: Math.round(ytdActivities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)),
    },
    records: PROFILE_RECORD_KEYS.map((key) => allRecords.find((r) => r.key === key)).filter(
      (r): r is RecordEntry => r !== undefined
    ),
    shoes: getShoeStats().filter((s) => !s.retired),
    goal,
    athlete,
  }
}
