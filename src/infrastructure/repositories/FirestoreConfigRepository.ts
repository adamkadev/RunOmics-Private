import { getAdminFirestore } from '@/lib/firebase-admin'
import type { GoalYear, PbYear, UpcomingRaceYear } from '@/application/usecases/GetGoalsData'

export interface AthleteProfile {
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  thresholdPowerWatts?: number
  vmaKmh?: number
  displayName?: string
  // Top bpm of zones 1-4 (zone 5 runs from the 4th value up to lthrBpm).
  hrZoneBoundsBpm?: [number, number, number, number]
  // Used by the TRIMP training-load calculation (GetTrainingLoad.ts). Falls
  // back to population-average defaults when not set.
  maxHrBpm?: number
  restingHrBpm?: number
  lastUpdate?: string
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
  const data = doc.data()
  if (!data) return {}
  return { ...data, lastUpdate: data.lastUpdate?.toDate().toISOString() } as AthleteProfile
}

export type PrState = Record<string, { seconds: number; activityId: string }>

export async function getLastPrState(): Promise<PrState | null> {
  const db = getAdminFirestore()
  const doc = await db.collection('notifications').doc('lastPrs').get()
  return doc.exists ? (doc.data() as PrState) : null
}

export async function saveLastPrState(state: PrState): Promise<void> {
  const db = getAdminFirestore()
  await db.collection('notifications').doc('lastPrs').set(state)
}

export type ShoeWearState = Record<string, { alerted: boolean }>

export async function getLastShoeWearState(): Promise<ShoeWearState | null> {
  const db = getAdminFirestore()
  const doc = await db.collection('notifications').doc('lastShoeWear').get()
  return doc.exists ? (doc.data() as ShoeWearState) : null
}

export async function saveLastShoeWearState(state: ShoeWearState): Promise<void> {
  const db = getAdminFirestore()
  await db.collection('notifications').doc('lastShoeWear').set(state)
}

export interface OverreachingState {
  alerted: boolean
}

export async function getLastOverreachingState(): Promise<OverreachingState | null> {
  const db = getAdminFirestore()
  const doc = await db.collection('notifications').doc('lastOverreaching').get()
  return doc.exists ? (doc.data() as OverreachingState) : null
}

export async function saveLastOverreachingState(state: OverreachingState): Promise<void> {
  const db = getAdminFirestore()
  await db.collection('notifications').doc('lastOverreaching').set(state)
}
