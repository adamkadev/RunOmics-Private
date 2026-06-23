import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteFromFirestore, type AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { getRecords, type RecordEntry } from '@/application/usecases/GetRecords'
import { round } from '@/lib/math'

const PROFILE_RECORD_KEYS = ['5k', '10k', 'half', 'marathon']

export interface ProfileHero {
  sinceDate: string | null
  lifetimeActivities: number
  lifetimeDistanceKm: number
}

export interface ProfileYtdStats {
  distanceKm: number
  durationSeconds: number
  sessionCount: number
  elevationGainM: number
}

export interface ProfileData {
  hero: ProfileHero
  ytd: ProfileYtdStats
  records: RecordEntry[]
  athlete: AthleteProfile
}

export async function getProfileData(): Promise<ProfileData> {
  const activities = getAllActivities()
  const lifetime = getLifetimeStats()
  const allRecords = await getRecords()
  const athlete = await getAthleteFromFirestore()

  const sinceDate = activities.length
    ? activities.reduce((min, a) => (a.date < min ? a.date : min), activities[0].date)
    : null

  const currentYear = new Date().getFullYear()
  const ytdActivities = activities.filter((a) => a.date.startsWith(String(currentYear)))

  return {
    hero: {
      sinceDate,
      lifetimeActivities: lifetime?.totalActivities ?? 0,
      lifetimeDistanceKm: lifetime ? round(lifetime.totalDistanceKm, 0) : 0,
    },
    ytd: {
      distanceKm: round(ytdActivities.reduce((s, a) => s + a.distanceKm, 0), 0),
      durationSeconds: ytdActivities.reduce((s, a) => s + a.durationSeconds, 0),
      sessionCount: ytdActivities.length,
      elevationGainM: Math.round(ytdActivities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)),
    },
    records: PROFILE_RECORD_KEYS.map((key) => allRecords.find((r) => r.key === key)).filter(
      (r): r is RecordEntry => r !== undefined
    ),
    athlete,
  }
}
