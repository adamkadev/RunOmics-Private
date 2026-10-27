import { getAdminFirestore } from '@/lib/firebase-admin'
import { DEFAULT_SHOE_DOC, RUN_SHOES_COLLECTION, SHOE_SETTINGS_COLLECTION } from '@/lib/shoeChoices'
import { withTimeout } from '@/lib/withTimeout'

/** The nightly backup's first Firestore call is cold. */
const READ_TIMEOUT_MS = 10_000

export interface ShoeChoicesRead {
  runs: Map<string, string>
  defaultGearId: string | null
  available: boolean
}

const UNAVAILABLE: ShoeChoicesRead = { runs: new Map(), defaultGearId: null, available: false }

const gearIdOf = (data: unknown) => {
  const gearId = (data as { gearId?: unknown } | undefined)?.gearId
  return typeof gearId === 'string' && gearId !== '' ? gearId : null
}

export async function getShoeChoicesFromFirestore(): Promise<ShoeChoicesRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const db = getAdminFirestore()
    const read = await withTimeout(
      Promise.all([db.collection(RUN_SHOES_COLLECTION).get(), db.collection(SHOE_SETTINGS_COLLECTION).doc(DEFAULT_SHOE_DOC).get()]),
      READ_TIMEOUT_MS,
      null
    )
    if (!read) return UNAVAILABLE
    const [runShoes, defaultShoe] = read

    const runs = new Map<string, string>()
    for (const doc of runShoes.docs) {
      const gearId = gearIdOf(doc.data())
      if (gearId) runs.set(doc.id, gearId)
    }
    return { runs, defaultGearId: defaultShoe.exists ? gearIdOf(defaultShoe.data()) : null, available: true }
  } catch {
    return UNAVAILABLE
  }
}
