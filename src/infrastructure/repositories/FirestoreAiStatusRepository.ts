import { getAdminFirestore } from '@/lib/firebase-admin'
import type { AiPassStatus } from '@/domain/ai/passStatus'

function lastPass() {
  return getAdminFirestore().collection('aiStatus').doc('lastPass')
}

export async function readAiPassStatus(): Promise<AiPassStatus | null> {
  const snapshot = await lastPass().get()
  return snapshot.exists ? (snapshot.data() as AiPassStatus) : null
}

export async function saveAiPassStatus(status: AiPassStatus): Promise<void> {
  await lastPass().set(status)
}
