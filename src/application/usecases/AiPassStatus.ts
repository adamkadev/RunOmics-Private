import { nextPassStatus, shouldAlert, type AiPassStatus, type PassReport } from '@/domain/ai/passStatus'
import { integrationStatus } from '@/infrastructure/integrations'
import { readAiPassStatus, saveAiPassStatus } from '@/infrastructure/repositories/FirestoreAiStatusRepository'

export async function lastAiPass(): Promise<AiPassStatus | null> {
  return integrationStatus().firebaseAdmin ? readAiPassStatus() : null
}

/** `alert` is true once per run of idle nights: the status is saved as alerted before the caller pushes. */
export async function recordAiPass(report: PassReport, now = new Date()): Promise<{ status: AiPassStatus; alert: boolean }> {
  const next = nextPassStatus(report, await readAiPassStatus(), now)
  const alert = shouldAlert(next)
  const status = alert ? { ...next, alerted: true } : next
  await saveAiPassStatus(status)
  return { status, alert }
}
