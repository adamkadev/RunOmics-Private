import { getAdminFirestore } from '@/lib/firebase-admin'
import type { GoalYear, PbYear, UpcomingRaceYear } from '@/application/usecases/GetGoalsData'

export interface AthleteProfile {
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  thresholdPowerWatts?: number
  weightKg?: number
}

export async function getGoalsFromFirestore(): Promise<GoalYear[]> {
  const db = getAdminFirestore()
  const snapshot = await db.collection('goals').get()
  return snapshot.docs.map((doc) => doc.data() as GoalYear)
}

export async function getPbsFromFirestore(): Promise<PbYear[]> {
  const db = getAdminFirestore()
  const snapshot = await db.collection('pbs').get()
  return snapshot.docs.map((doc) => doc.data() as PbYear)
}

export async function getUpcomingRacesFromFirestore(): Promise<UpcomingRaceYear[]> {
  const db = getAdminFirestore()
  const snapshot = await db.collection('upcomingRaces').get()
  return snapshot.docs.map((doc) => doc.data() as UpcomingRaceYear)
}

export async function getAthleteFromFirestore(): Promise<AthleteProfile> {
  const db = getAdminFirestore()
  const doc = await db.collection('athlete').doc('profile').get()
  return (doc.data() ?? {}) as AthleteProfile
}
