import { getAdminFirestore } from '@/lib/firebase-admin'
import type { JobEvent } from '@/domain/diagnostics/jobEvent'

const COLLECTION = 'jobEvents'

export async function keepJobEvent(event: JobEvent, keep: number): Promise<void> {
  const collection = getAdminFirestore().collection(COLLECTION)
  await collection.add(event)
  const stale = await collection.orderBy('at', 'desc').offset(keep).get()
  await Promise.all(stale.docs.map((doc) => doc.ref.delete()))
}

export async function recentJobEvents(limit: number): Promise<JobEvent[]> {
  const snapshot = await getAdminFirestore().collection(COLLECTION).orderBy('at', 'desc').limit(limit).get()
  return snapshot.docs.map((doc) => doc.data() as JobEvent)
}
