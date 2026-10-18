import { DAY_MS, appTodayIso } from '@/lib/calendarDate'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile, type AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getVo2maxNorms } from '@/infrastructure/repositories/JsonVo2maxNormsRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getRecords, type RecordEntry } from '@/application/usecases/GetRecords'
import { getShoeStats, type ShoeStats } from '@/application/usecases/GetShoeStats'
import { computeProjection, type GoalYear, type GoalProjection } from '@/application/usecases/GetGoalsData'
import { getAthleteRank, type AthleteRank } from '@/application/usecases/GetAthleteRank'
import { sumDistanceKm, yearDistanceKm } from '@/domain/activity/distance'
import { round } from '@/lib/math'
import { vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { sameDateLastYear, yearToDate } from '@/domain/activity/sameDate'

const PROFILE_RECORD_KEYS = ['5k', '10k', 'half', 'marathon']

export interface ProfileHero {
  sinceDate: string | null
  lifetimeActivities: number
  lifetimeDistanceKm: number
  rank: AthleteRank | null
  vo2maxTopPercent: number | null
  lastRunDate: string | null
  activeDays: number
}

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
  prevYear: ProfilePeriodStats | null
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

export async function getProfileData(today: string = appTodayIso()): Promise<ProfileData> {
  const activities = getAllActivities()
  const lifetime = getLifetimeStats()
  const allRecords = await getRecords()
  const goalYears = getGoalYears()
  const athlete = getAthleteProfile()
  const vo2maxNorms = getVo2maxNorms()
  const rank = getAthleteRank(allRecords, athlete, vo2maxNorms)

  const firstActivity = activities[0]
  const sinceDate = firstActivity
    ? activities.reduce((min, a) => (a.date < min ? a.date : min), firstActivity.date)
    : null

  const now = new Date(`${today}T12:00:00`)
  const currentYear = now.getFullYear()
  const elapsedDaysThisYear = Math.max(
    1,
    Math.floor((now.getTime() - new Date(currentYear, 0, 1).getTime()) / DAY_MS) + 1,
  )
  const ytdActivities = activities.filter((a) => a.date.startsWith(String(currentYear)))
  const ytdDistanceKm = ytdActivities.reduce((s, a) => s + a.distanceKm, 0)
  const ytdDistanceKmRounded = yearDistanceKm(activities, currentYear)

  const prevYear = currentYear - 1
  const prevYearActivities = yearToDate(activities, prevYear, sameDateLastYear(today))
  const prevYearStats =
    prevYearActivities.length > 0
      ? periodStats(prevYearActivities, sumDistanceKm(prevYearActivities), elapsedDaysThisYear)
      : null

  const elapsedDaysAllTime = Math.max(
    1,
    sinceDate
      ? Math.floor((now.getTime() - new Date(sinceDate + 'T00:00:00').getTime()) / DAY_MS) + 1
      : 1,
  )

  const goalYear = goalYears.find((g) => g.year === currentYear) ?? null
  const goal: ProfileGoal | null = goalYear
    ? {
        goalYear,
        totalDistanceKm: ytdDistanceKmRounded,
        projection: computeProjection(activities, currentYear, ytdDistanceKm, goalYear, now),
      }
    : null

  return {
    hero: {
      sinceDate,
      lifetimeActivities: lifetime?.totalActivities ?? 0,
      lifetimeDistanceKm: lifetime ? round(lifetime.totalDistanceKm, 0) : 0,
      rank,
      vo2maxTopPercent: rank?.vo2maxGarmin != null && athlete.age !== undefined && athlete.sex
        ? vo2maxTopPercent(rank.vo2maxGarmin, athlete.age, athlete.sex, vo2maxNorms)
        : null,
      lastRunDate: activities[0]?.date ?? null,
      activeDays: new Set(activities.map((a) => a.date)).size,
    },
    ytd: periodStats(ytdActivities, ytdDistanceKmRounded, elapsedDaysThisYear),
    allTime: periodStats(activities, sumDistanceKm(activities), elapsedDaysAllTime),
    prevYear: prevYearStats,
    records: PROFILE_RECORD_KEYS.map((key) => allRecords.find((r) => r.key === key)).filter(
      (r): r is RecordEntry => r !== undefined
    ),
    shoes: getShoeStats().filter((s) => !s.retired),
    goal,
    athlete,
  }
}
