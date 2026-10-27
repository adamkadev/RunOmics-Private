import { getLatestRunVerdict } from '@/application/usecases/GetRunVerdictInsight'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { formatDistance, formatDuration } from '@/lib/formatters'

interface VerdictState {
  lastSyncedAt: string | null
  generatedAt: string | null
  hasVerdict: boolean
}

export interface Readiness {
  ready: boolean
  synced: boolean
  reason?: string
}

/**
 * `ready` means a verdict written since you asked: until Vercel redeploys with
 * the new data, the previous deployment answers with the previous run's card.
 * `synced` tells which half of the chain a stuck poll is waiting on.
 */
export function verdictReadiness(state: VerdictState, since: number | null): Readiness {
  const synced = isAfter(state.lastSyncedAt, since)
  if (isAfter(state.generatedAt, since) && state.hasVerdict) return { ready: true, synced }

  const reason = !synced
    ? 'waiting for the deployment carrying this sync'
    : state.hasVerdict
      ? 'verdict predates this sync'
      : 'no verdict for this run yet'

  return { ready: false, synced, reason }
}

function isAfter(timestamp: string | null, since: number | null): boolean {
  if (timestamp === null) return false
  if (since === null) return true

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) && parsed > since
}

export function parseSince(raw: string | null): number | null | 'invalid' {
  if (raw === null) return null

  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? 'invalid' : parsed
}

export async function verdictStatus(since: number | null) {
  const lastSyncedAt = getLastSyncedAt()
  const latest = await getLatestRunVerdict()
  if (!latest) {
    return { ready: false, reason: 'no activities', synced: false, activity: null, verdict: null }
  }

  const { activity, verdict, generatedAt } = latest
  const readiness = verdictReadiness({ lastSyncedAt, generatedAt, hasVerdict: verdict !== null }, since)

  return {
    ...readiness,
    activity: {
      id: activity.id,
      distance: formatDistance(activity.distanceKm),
      duration: formatDuration(activity.durationSeconds),
    },
    // Never the previous run's card while waiting, or a client could announce it.
    verdict: readiness.ready ? verdict : null,
  }
}
