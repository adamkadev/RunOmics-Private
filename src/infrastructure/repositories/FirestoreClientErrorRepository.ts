import { getAdminFirestore } from '@/lib/firebase-admin'
import type { ClientErrorReport } from '@/domain/diagnostics/clientError'

const COLLECTION = 'clientErrors'

export async function keepClientError(report: ClientErrorReport, keep: number): Promise<void> {
  const collection = getAdminFirestore().collection(COLLECTION)
  await collection.add(report)
  const stale = await collection.orderBy('at', 'desc').offset(keep).get()
  await Promise.all(stale.docs.map((doc) => doc.ref.delete()))
}

export async function recentClientErrors(limit: number): Promise<ClientErrorReport[]> {
  const snapshot = await getAdminFirestore().collection(COLLECTION).orderBy('at', 'desc').limit(limit).get()
  return snapshot.docs.map((doc) => doc.data() as ClientErrorReport)
}
