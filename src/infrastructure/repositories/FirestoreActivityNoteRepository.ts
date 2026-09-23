import { getAdminFirestore } from '@/lib/firebase-admin'

const COLLECTION = 'activityNotes'

/**
 * Generous on purpose. The only caller is the coaching CLI, a batch job where
 * ten seconds is free, and its first Firestore call is always cold: the admin
 * SDK fetches an OAuth token before the query. A request-path budget here
 * would report "no notes" for a correctly configured install that was merely
 * starting up, which is the one failure this read must not invent.
 */
const READ_TIMEOUT_MS = 10_000

export interface ActivityNote {
  note: string
  tags: string[]
}

/**
 * `available` separates "the athlete has annotated nothing" from "this process
 * could not ask". Both produce an empty map, and a coaching prompt built from
 * the second while believing the first is worse than one that never had notes
 * at all: it reads an unexplained RPE as fitness when the athlete wrote
 * "sick" on the session. Callers are expected to say so out loud.
 */
export interface ActivityNotesRead {
  notes: Map<string, ActivityNote>
  available: boolean
}

const UNAVAILABLE: ActivityNotesRead = { notes: new Map(), available: false }

function read(data: Record<string, unknown>): ActivityNote {
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : []
  return { note: typeof data.note === 'string' ? data.note : '', tags }
}

/**
 * Notes and tags are written from the RunOmics UI only - Garmin Connect's own
 * comment field is never used here, and the activity JSON's `comment` is left
 * empty by the importer - so this collection is their only source.
 */
export async function getActivityNotes(): Promise<ActivityNotesRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const snapshot = await Promise.race([
      getAdminFirestore().collection(COLLECTION).get(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
    if (!snapshot) return UNAVAILABLE

    const notes = new Map<string, ActivityNote>()
    for (const doc of snapshot.docs) {
      const note = read(doc.data() as Record<string, unknown>)
      if (note.note !== '' || note.tags.length > 0) notes.set(doc.id, note)
    }
    return { notes, available: true }
  } catch {
    return UNAVAILABLE
  }
}
