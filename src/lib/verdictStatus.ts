import { getLatestRunVerdict } from '@/application/usecases/GetRunVerdictInsight'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * How far a sync has got, answered the same way for the iOS shortcut polling
 * `/api/internal/latest-verdict` and for the Sync button in Settings polling
 * `/api/sync/status`. One implementation, because the two would otherwise
 * disagree about what "done" means.
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
 * `ready` is not "a verdict exists" but "a verdict written since you asked".
 *
 * The verdict is written by the ai-insights pass, which cannot see a new run
 * until Vercel has redeployed with the new data - about five minutes after the
 * workflow starts. Until then the poll is answered by the *previous*
 * deployment, serving the previous run and the card that run already had, so
 * without `since` every wait would end instantly on the wrong run.
 *
 * `synced` is reported alongside so a poll that never finishes can say which
 * half of the chain it is stuck on: an app still serving pre-sync data, or a
 * live deployment whose run has not been written up yet.
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

/** Without a `since` to measure against, whatever is stored counts as current. */
function isAfter(timestamp: string | null, since: number | null): boolean {
  if (timestamp === null) return false
  if (since === null) return true

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) && parsed > since
}

/** `null` when absent, `'invalid'` when it is not a timestamp we can compare. */
export function parseSince(raw: string | null): number | null | 'invalid' {
  if (raw === null) return null

  const parsed = parseTimestamp(raw)
  return parsed === null ? 'invalid' : parsed
}

/**
 * Shortcuts formats a date in local time - `2026-09-19T23:04:07+02:00` - and an
 * unencoded `+` in a query string arrives here as a space. Rather than make the
 * shortcut carry a URL-encode step that is easy to leave out and gives a 400
 * five minutes later, put the plus back when that is all that is wrong.
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
      name: activity.description || t.activity.runTitle(activity.dayOfWeek),
      type: activity.type,
      distance: formatDistance(activity.distanceKm),
      duration: formatDuration(activity.durationSeconds),
      pace: activity.paceSecPerKm === null ? null : formatPace(activity.paceSecPerKm),
      url: `${origin}/activities/${activity.id}`,
    },
    // Only ever the verdict that was asked for. Handing back the previous run's
    // card on a poll that is still waiting invites a client to announce it, and
    // makes "headline has a value" a sound ready test for one that cannot match
    // a JSON boolean cleanly.
    verdict: readiness.ready ? verdict : null,
  }
}
