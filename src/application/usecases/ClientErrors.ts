import { parseClientError, type ClientErrorReport } from '@/domain/diagnostics/clientError'
import { integrationStatus } from '@/infrastructure/integrations'
import { keepClientError, recentClientErrors } from '@/infrastructure/repositories/FirestoreClientErrorRepository'

/** Enough to see a pattern; a phone's failures on a bad day would otherwise fill Firestore. */
export const CLIENT_ERRORS_KEPT = 50

/** Logged either way: Vercel keeps a log for half an hour, Firestore keeps the last fifty for Settings. */
export async function recordClientError(body: unknown, now = new Date()): Promise<ClientErrorReport | null> {
  const report = parseClientError(body, now)
  if (!report) return null
  console.warn('[client-error]', JSON.stringify(report))
  if (integrationStatus().firebaseAdmin) await keepClientError(report, CLIENT_ERRORS_KEPT)
  return report
}

export async function listClientErrors(): Promise<ClientErrorReport[]> {
  return integrationStatus().firebaseAdmin ? recentClientErrors(CLIENT_ERRORS_KEPT) : []
}
