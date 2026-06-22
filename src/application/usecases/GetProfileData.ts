import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteFromFirestore, type AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { getLifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { round } from '@/lib/math'

export interface ProfileHero {
  sinceDate: string | null
  lifetimeActivities: number
  lifetimeDistanceKm: number
}

export interface ProfileData {
  hero: ProfileHero
  athlete: AthleteProfile
}

export async function getProfileData(): Promise<ProfileData> {
  const activities = getAllActivities()
  const lifetime = getLifetimeStats()
  const athlete = await getAthleteFromFirestore()

  const sinceDate = activities.length
    ? activities.reduce((min, a) => (a.date < min ? a.date : min), activities[0].date)
    : null

  return {
    hero: {
      sinceDate,
      lifetimeActivities: lifetime?.totalActivities ?? 0,
      lifetimeDistanceKm: lifetime ? round(lifetime.totalDistanceKm, 0) : 0,
    },
    athlete,
  }
}
