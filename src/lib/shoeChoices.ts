import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'

/** One document per run, keyed by activity id: the shoe the owner picked in the app. */
export const RUN_SHOES_COLLECTION = 'runShoes'

async function store() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
}

async function readGearId(collection: string, id: string): Promise<string | null> {
  if (!isClientFirebaseConfigured) return null
  const { firestore: { doc, getDoc }, db } = await store()
  const snap = await getDoc(doc(db, collection, id))
  const gearId = snap.exists() ? (snap.data() as { gearId?: unknown }).gearId : null
  return typeof gearId === 'string' ? gearId : null
}

/** Null clears the pick, leaving the run to Garmin's shoe. */
async function writeGearId(collection: string, id: string, gearId: string | null): Promise<void> {
  const { firestore: { doc, deleteDoc, setDoc }, db } = await store()
  const ref = doc(db, collection, id)
  if (gearId === null) await deleteDoc(ref)
  else await setDoc(ref, { gearId })
}

export const readRunShoe = (activityId: string) => readGearId(RUN_SHOES_COLLECTION, activityId)
export const writeRunShoe = (activityId: string, gearId: string | null) => writeGearId(RUN_SHOES_COLLECTION, activityId, gearId)
