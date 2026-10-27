import { getAdminFirestore } from '@/lib/firebase-admin'
import { withTimeout } from '@/lib/withTimeout'
import { isEmptyNote } from '@/domain/activity/activityNote'

const COLLECTION = 'activityNotes'

/** Generous: the only caller is a batch CLI whose first Firestore call is cold, and a short budget would invent "no notes". */
const READ_TIMEOUT_MS = 10_000

export interface ActivityNote {
  note: string
  tags: string[]
  /** The owner's "HR unreliable" mark: the run's heart rate leaves every load, zone and efficiency figure. */
  hrUnreliable?: true
}

/** `available` tells "annotated nothing" from "could not ask": a prompt built from the second reads an unexplained RPE as fitness. */
export interface ActivityNotesRead {
  notes: Map<string, ActivityNote>
  available: boolean
}

const UNAVAILABLE: ActivityNotesRead = { notes: new Map(), available: false }

function read(data: Record<string, unknown>): ActivityNote {
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : []
  return { note: typeof data.note === 'string' ? data.note : '', tags, ...(data.hrUnreliable === true ? { hrUnreliable: true } : {}) }
}

/** Notes and tags come from the RunOmics UI only - Garmin Connect's comment field is never used - so this collection is their only source. */
export async function getActivityNotes(): Promise<ActivityNotesRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const snapshot = await withTimeout(getAdminFirestore().collection(COLLECTION).get(), READ_TIMEOUT_MS, null)
    if (!snapshot) return UNAVAILABLE

    const notes = new Map<string, ActivityNote>()
    for (const doc of snapshot.docs) {
      const note = read(doc.data() as Record<string, unknown>)
      if (!isEmptyNote(note)) notes.set(doc.id, note)
    }
    return { notes, available: true }
  } catch {
    return UNAVAILABLE
  }
}

/** A request path, so a short budget; the page reads notes through the app so a private site's gate covers them. */
const NOTE_TIMEOUT_MS = 4_000

export type ActivityNoteRead = { available: false } | { available: true; note: ActivityNote | null }

export async function getActivityNote(activityId: string): Promise<ActivityNoteRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return { available: false }

  try {
    const snapshot = await withTimeout(getAdminFirestore().collection(COLLECTION).doc(activityId).get(), NOTE_TIMEOUT_MS, null)
    if (!snapshot) return { available: false }
    if (!snapshot.exists) return { available: true, note: null }
    return { available: true, note: read(snapshot.data() as Record<string, unknown>) }
  } catch {
    return { available: false }
  }
}
