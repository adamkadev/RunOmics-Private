import { getAdminFirestore } from '@/lib/firebase-admin'
import { AVOID_SPOTS_COLLECTION, readAvoidSpot } from '@/lib/avoidSpots'
import { ROUTE_NAMES_COLLECTION } from '@/lib/routeNames'
import type { AvoidSpot } from '@/domain/explore/avoidSpots'
import { withTimeout } from '@/lib/withTimeout'

/** The nightly backup's first Firestore call is cold. */
const READ_TIMEOUT_MS = 10_000

export interface RouteDataRead {
  routeNames: Map<string, string>
  avoidSpots: AvoidSpot[]
  available: boolean
}

const UNAVAILABLE: RouteDataRead = { routeNames: new Map(), avoidSpots: [], available: false }

/** Both are written from the phone only, so Firestore holds their only copy. */
export async function getRouteData(): Promise<RouteDataRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const db = getAdminFirestore()
    const read = await withTimeout(
      Promise.all([db.collection(ROUTE_NAMES_COLLECTION).get(), db.collection(AVOID_SPOTS_COLLECTION).get()]),
      READ_TIMEOUT_MS,
      null
    )
    if (!read) return UNAVAILABLE
    const [names, spots] = read

    const routeNames = new Map<string, string>()
    for (const doc of names.docs) {
      const name = (doc.data() as { name?: unknown }).name
      if (typeof name === 'string' && name.trim() !== '') routeNames.set(doc.id, name)
    }
    const avoidSpots = spots.docs
      .map((doc) => readAvoidSpot(doc.id, doc.data() as Record<string, unknown>))
      .filter((spot): spot is AvoidSpot => spot !== null)
    return { routeNames, avoidSpots, available: true }
  } catch {
    return UNAVAILABLE
  }
}
