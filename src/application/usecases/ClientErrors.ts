import { errorsSince, parseClientError, type ClientErrorReport } from '@/domain/diagnostics/clientError'
import { failedSince, type JobEvent } from '@/domain/diagnostics/jobEvent'
import { integrationStatus } from '@/infrastructure/integrations'
import { keepClientError, recentClientErrors } from '@/infrastructure/repositories/FirestoreClientErrorRepository'
import { getLastClientErrorAlertState, saveLastClientErrorAlertState } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { listJobEvents } from './JobEvents'

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

export interface ClientErrorDigest {
  fresh: ClientErrorReport[]
  serverErrors: JobEvent[]
  commit: () => Promise<void>
}

/** Nothing is stored until `commit()`, so a failed push is offered again next sync. */
export async function getClientErrorDigest(): Promise<ClientErrorDigest> {
  const [recent, jobs, last] = await Promise.all([listClientErrors(), listJobEvents(), getLastClientErrorAlertState()])
  const newest = recent[0]?.at ?? last?.lastAt ?? null
  // Any run moves the mark, not only a failed one, so the first server error after a quiet first check is announced.
  const newestJob = jobs[0]?.at ?? last?.jobErrorAt ?? null
  return {
    fresh: errorsSince(recent, last?.lastAt ?? null),
    serverErrors: failedSince(jobs, last?.jobErrorAt ?? null),
    commit: async () => {
      if (newest || newestJob) await saveLastClientErrorAlertState({ lastAt: newest, jobErrorAt: newestJob })
    },
  }
}
