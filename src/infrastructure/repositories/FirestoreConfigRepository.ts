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

// Read at build time (SSG) - a Firestore outage must not fail the whole build.
function logFirestoreReadError(collection: string, error: unknown): void {
  console.error(`[firestore:${collection}] read failed, falling back to empty result`, error)
}

// These collections are small and rarely change, but are re-read independently by
// many pages/use-cases (dashboard, calendar, analytics, every static activity page,
// etc). Without this, a single `next build` re-reads the same doc hundreds of times.
// Cached per server process for a short window; writes also trigger an explicit
// revalidatePath via /api/internal/revalidate, so this is a bound on worst-case
// staleness rather than the primary invalidation path.
const CACHE_TTL_MS = 5 * 60 * 1000

function cached<T>(fetcher: () => Promise<T>): () => Promise<T> {
  let entry: { value: Promise<T>; expiresAt: number } | null = null
  return () => {
    if (entry && entry.expiresAt > Date.now()) return entry.value
    const value = fetcher().catch((error) => {
      entry = null
      throw error
    })
    entry = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  }
}

export const getGoalsFromFirestore = cached(async (): Promise<GoalYear[]> => {
  try {
    const db = getAdminFirestore()
    const snapshot = await db.collection('goals').get()
    return snapshot.docs.map((doc) => doc.data() as GoalYear)
  } catch (error) {
    logFirestoreReadError('goals', error)
    return []
  }
})

export const getPbsFromFirestore = cached(async (): Promise<PbYear[]> => {
  try {
    const db = getAdminFirestore()
    const snapshot = await db.collection('pbs').get()
    return snapshot.docs.map((doc) => doc.data() as PbYear)
  } catch (error) {
    logFirestoreReadError('pbs', error)
    return []
  }
})

export const getUpcomingRacesFromFirestore = cached(async (): Promise<UpcomingRaceYear[]> => {
  try {
    const db = getAdminFirestore()
    const snapshot = await db.collection('upcomingRaces').get()
    return snapshot.docs.map((doc) => doc.data() as UpcomingRaceYear)
  } catch (error) {
    logFirestoreReadError('upcomingRaces', error)
    return []
  }
})

export const getAthleteFromFirestore = cached(async (): Promise<AthleteProfile> => {
  try {
    const db = getAdminFirestore()
    const doc = await db.collection('athlete').doc('profile').get()
    const data = doc.data()
    if (!data) return {}
    return { ...data, lastUpdate: data.lastUpdate?.toDate().toISOString() } as AthleteProfile
  } catch (error) {
    logFirestoreReadError('athlete', error)
    return {}
  }
})

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
