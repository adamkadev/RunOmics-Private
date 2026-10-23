import { getLatestRunVerdict } from '@/application/usecases/GetRunVerdictInsight'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { activityTitle } from '@/lib/activityTitle'

/**
 * Shared by the iOS shortcut's poll and the Settings Sync button's, so the two
 * agree on what "done" means.
 */

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

  const parsed = parseTimestamp(raw)
  return parsed === null ? 'invalid' : parsed
}

/**
 * Shortcuts sends a local-time offset (`+02:00`) unencoded, so its `+` arrives
 * as a space: put the plus back.
 */
function parseTimestamp(raw: string): number | null {
  const direct = Date.parse(raw)
  if (!Number.isNaN(direct)) return direct

  const repaired = Date.parse(raw.replace(/ (\d{2}:?\d{2})$/, '+$1'))
  return Number.isNaN(repaired) ? null : repaired
}

export async function verdictStatus(origin: string, since: number | null) {
  const lastSyncedAt = getLastSyncedAt()
  const latest = await getLatestRunVerdict()
  if (!latest) {
    return { ready: false, reason: 'no activities', synced: false, lastSyncedAt, activity: null, verdict: null }
  }

  const { activity, verdict, generatedAt } = latest
  const readiness = verdictReadiness({ lastSyncedAt, generatedAt, hasVerdict: verdict !== null }, since)

  return {
    ...readiness,
    lastSyncedAt,
    generatedAt,
    activity: {
      id: activity.id,
      date: activity.date,
      name: activityTitle(activity),
      type: activity.type,
      distance: formatDistance(activity.distanceKm),
      duration: formatDuration(activity.durationSeconds),
      pace: activity.paceSecPerKm === null ? null : formatPace(activity.paceSecPerKm),
      url: `${origin}/activities/${activity.id}`,
    },
    // Never the previous run's card while waiting, or a client could announce it.
    verdict: readiness.ready ? verdict : null,
  }
}
