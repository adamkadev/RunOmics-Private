import { AVOID_LIMITS, AVOID_REASONS, AVOID_SPOT_RADIUS_M, expiryFor, type AvoidReason, type AvoidSpot } from '@/domain/explore/avoidSpots'
import { appTodayIso } from '@/lib/calendarDate'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'

export const AVOID_SPOTS_COLLECTION = 'avoidSpots'

async function store() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
}

const isReason = (value: unknown): value is AvoidReason => AVOID_REASONS.includes(value as AvoidReason)

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** A malformed document is skipped rather than sent to the router. */
export function readAvoidSpot(id: string, data: Record<string, unknown>): AvoidSpot | null {
  const { lon, lat, radiusM, createdAt, reason, expiresOn } = data
  if (typeof lon !== 'number' || typeof lat !== 'number' || typeof radiusM !== 'number' || typeof createdAt !== 'string') return null
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null
  if (radiusM < AVOID_LIMITS.minRadiusM || radiusM > AVOID_LIMITS.maxRadiusM) return null
  return {
    id,
    lon,
    lat,
    radiusM,
    createdAt,
    reason: isReason(reason) ? reason : null,
    expiresOn: typeof expiresOn === 'string' && DATE.test(expiresOn) ? expiresOn : null,
  }
}

export async function readAvoidSpots(): Promise<AvoidSpot[]> {
  if (!isClientFirebaseConfigured) return []
  const { firestore: { collection, getDocs }, db } = await store()
  const snapshot = await getDocs(collection(db, AVOID_SPOTS_COLLECTION))
  const spots: AvoidSpot[] = []
  snapshot.forEach((entry) => {
    const spot = readAvoidSpot(entry.id, entry.data())
    if (spot) spots.push(spot)
  })
  return spots.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

/** Six decimals, about 10 cm: as precise as a tap on a map is, and no more. */
export async function addAvoidSpot([lon, lat]: [number, number], radiusM: number = AVOID_SPOT_RADIUS_M): Promise<AvoidSpot> {
  const { firestore: { addDoc, collection }, db } = await store()
  const spot = { lon: +lon.toFixed(6), lat: +lat.toFixed(6), radiusM, createdAt: appTodayIso() }
  const ref = await addDoc(collection(db, AVOID_SPOTS_COLLECTION), spot)
  return { id: ref.id, ...spot, reason: null, expiresOn: null }
}

/** The expiry runs from the day the reason is given, which is when the owner last saw the spot. */
export async function setAvoidSpotReason(id: string, reason: AvoidReason | null, today: string = appTodayIso()): Promise<void> {
  const { firestore: { deleteField, doc, updateDoc }, db } = await store()
  const expiresOn = expiryFor(reason, today)
  await updateDoc(doc(db, AVOID_SPOTS_COLLECTION, id), { reason: reason ?? deleteField(), expiresOn: expiresOn ?? deleteField() })
}

export async function setAvoidSpotRadius(id: string, radiusM: number): Promise<void> {
  const { firestore: { doc, updateDoc }, db } = await store()
  await updateDoc(doc(db, AVOID_SPOTS_COLLECTION, id), { radiusM })
}

export async function deleteAvoidSpot(id: string): Promise<void> {
  const { firestore: { deleteDoc, doc }, db } = await store()
  await deleteDoc(doc(db, AVOID_SPOTS_COLLECTION, id))
}

export interface AvoidSpotStore {
  read: () => Promise<AvoidSpot[]>
  add: (lngLat: [number, number], radiusM: number) => Promise<AvoidSpot>
  setReason: (id: string, reason: AvoidReason | null, today: string) => Promise<void>
  setRadius: (id: string, radiusM: number) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const firestoreAvoidSpots: AvoidSpotStore = {
  read: readAvoidSpots,
  add: addAvoidSpot,
  setReason: setAvoidSpotReason,
  setRadius: setAvoidSpotRadius,
  remove: deleteAvoidSpot,
}
