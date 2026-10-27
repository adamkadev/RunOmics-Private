import { latestPerRoute, JOB_EVENTS_KEPT, type JobEvent } from '@/domain/diagnostics/jobEvent'
import { integrationStatus } from '@/infrastructure/integrations'
import { recentJobEvents } from '@/infrastructure/repositories/FirestoreJobEventRepository'

export async function listJobEvents(): Promise<JobEvent[]> {
  return integrationStatus().firebaseAdmin ? recentJobEvents(JOB_EVENTS_KEPT) : []
}

/** Settings → Diagnostics: each route's latest run, newest first. */
export async function lastJobRuns(): Promise<JobEvent[]> {
  return latestPerRoute(await listJobEvents())
}

export async function lastJobRun(route: string): Promise<JobEvent | null> {
  return (await listJobEvents()).find((event) => event.route === route) ?? null
}
