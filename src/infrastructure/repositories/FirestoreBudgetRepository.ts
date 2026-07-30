import { FieldValue } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { spendField } from '@/domain/ai/budget'

const COLLECTION = 'aiBudget'

/**
 * How many requests each model has already spent on a given quota day. The
 * ledger survives across cron runs, which is the whole point: the daily
 * ceiling is shared by every invocation, not by every process.
 */
export async function getSpend(day: string): Promise<Record<string, number>> {
  const doc = await getAdminFirestore().collection(COLLECTION).doc(day).get()
  return doc.exists ? (doc.data() as Record<string, number>) : {}
}

export async function recordSpend(day: string, model: string): Promise<void> {
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(day)
    .set({ [spendField(model)]: FieldValue.increment(1) }, { merge: true })
}
