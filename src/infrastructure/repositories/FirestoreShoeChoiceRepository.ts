import { getAdminFirestore } from '@/lib/firebase-admin'
import { RUN_SHOES_COLLECTION } from '@/lib/shoeChoices'
import { withTimeout } from '@/lib/withTimeout'

/** The nightly backup's first Firestore call is cold. */
const READ_TIMEOUT_MS = 10_000

export interface ShoeChoicesRead {
  runs: Map<string, string>
  available: boolean
}

const UNAVAILABLE: ShoeChoicesRead = { runs: new Map(), available: false }

const gearIdOf = (data: unknown) => {
  const gearId = (data as { gearId?: unknown } | undefined)?.gearId
  return typeof gearId === 'string' && gearId !== '' ? gearId : null
}

export async function getShoeChoicesFromFirestore(): Promise<ShoeChoicesRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const db = getAdminFirestore()
    const runShoes = await withTimeout(db.collection(RUN_SHOES_COLLECTION).get(), READ_TIMEOUT_MS, null)
    if (!runShoes) return UNAVAILABLE

    const runs = new Map<string, string>()
    for (const doc of runShoes.docs) {
      const gearId = gearIdOf(doc.data())
      if (gearId) runs.set(doc.id, gearId)
    }
    return { runs, available: true }
  } catch {
    return UNAVAILABLE
  }
}
