import { isCheckInDate, readCheckIn, WELLNESS_COLLECTION, type CheckIn } from '@/domain/wellness/checkIn'

/** Loaded on first use: only the owner reads or writes a check-in, so the SDK stays out of everyone's first load. */
async function store() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
}

export async function readCheckInDay(date: string): Promise<CheckIn | null> {
  const { firestore: { doc, getDoc }, db } = await store()
  const snapshot = await getDoc(doc(db, WELLNESS_COLLECTION, date))
  return snapshot.exists() ? readCheckIn(snapshot.data()) : null
}

/** Every day from `from` on, by date. */
export async function readCheckInsSince(from: string): Promise<Map<string, CheckIn>> {
  const { firestore: { collection, documentId, getDocs, orderBy, query, where }, db } = await store()
  const snapshot = await getDocs(query(collection(db, WELLNESS_COLLECTION), where(documentId(), '>=', from), orderBy(documentId())))
  const entries = new Map<string, CheckIn>()
  snapshot.forEach((day) => {
    const entry = isCheckInDate(day.id) ? readCheckIn(day.data()) : null
    if (entry) entries.set(day.id, entry)
  })
  return entries
}

/** The whole day is written each time, so a cleared answer is gone rather than merged back. */
export async function writeCheckInDay(date: string, entry: CheckIn | null): Promise<void> {
  const { firestore: { deleteDoc, doc, setDoc }, db } = await store()
  const ref = doc(db, WELLNESS_COLLECTION, date)
  if (entry) await setDoc(ref, entry)
  else await deleteDoc(ref)
}
