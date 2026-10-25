import { getAdminFirestore } from '@/lib/firebase-admin'
import { isCheckInDate, readCheckIn, WELLNESS_COLLECTION, type CheckIn } from '@/domain/wellness/checkIn'
import { withTimeout } from '../withTimeout'

/** Generous: the callers are the coaching CLI and the nightly backup, whose first Firestore call is cold. */
const READ_TIMEOUT_MS = 10_000

/** `available` tells "logged nothing" from "could not ask", as for run notes. */
export interface WellnessRead {
  entries: Map<string, CheckIn>
  available: boolean
}

const UNAVAILABLE: WellnessRead = { entries: new Map(), available: false }

/** Keyed by the athlete's local date; written from the Today check-in only. */
export async function getWellnessEntries(): Promise<WellnessRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const snapshot = await withTimeout(getAdminFirestore().collection(WELLNESS_COLLECTION).get(), READ_TIMEOUT_MS, null)
    if (!snapshot) return UNAVAILABLE

    const entries = new Map<string, CheckIn>()
    for (const doc of snapshot.docs) {
      if (!isCheckInDate(doc.id)) continue
      const entry = readCheckIn(doc.data())
      if (entry) entries.set(doc.id, entry)
    }
    return { entries, available: true }
  } catch {
    return UNAVAILABLE
  }
}
