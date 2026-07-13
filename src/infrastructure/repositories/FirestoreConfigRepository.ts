import { getAdminFirestore } from '@/lib/firebase-admin'

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

export interface StaleSyncState {
  alerted: boolean
}

export async function getLastStaleSyncState(): Promise<StaleSyncState | null> {
  const db = getAdminFirestore()
  const doc = await db.collection('notifications').doc('lastStaleSync').get()
  return doc.exists ? (doc.data() as StaleSyncState) : null
}

export async function saveLastStaleSyncState(state: StaleSyncState): Promise<void> {
  const db = getAdminFirestore()
  await db.collection('notifications').doc('lastStaleSync').set(state)
}

export interface ActivitySyncState {
  knownIds: string[]
}

export async function getLastActivitySyncState(): Promise<ActivitySyncState | null> {
  const db = getAdminFirestore()
  const doc = await db.collection('notifications').doc('lastActivitySync').get()
  return doc.exists ? (doc.data() as ActivitySyncState) : null
}

export async function saveLastActivitySyncState(state: ActivitySyncState): Promise<void> {
  const db = getAdminFirestore()
  await db.collection('notifications').doc('lastActivitySync').set(state)
}
