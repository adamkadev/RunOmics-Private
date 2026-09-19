import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getLatestRunVerdict } from '@/application/usecases/GetRunVerdictInsight'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * What the iOS shortcut polls while it waits for a freshly synced run to get
 * its AI verdict. See docs/ios-shortcut.md.
 *
 * A verdict is never ready when the sync ends: it is written by the ai-insights
 * pass, which cannot see the new run until Vercel has redeployed with the new
 * data - roughly five minutes after the workflow was dispatched. Until then the
 * poll is answered by the *previous* deployment, which still serves the
 * previous run and the verdict that run already had. So `ready` is not "a
 * verdict exists": it is "a verdict written since you asked", which `since`
 * pins down. Poll with the time you dispatched the workflow and the answer
 * cannot be last night's card.
 */
export async function GET(req: NextRequest) {
  return handleInternalRoute('latest-verdict', req, async () => {
    const since = sinceParam(req)
    if (since === 'invalid') {
      return NextResponse.json({ error: 'since must be an ISO 8601 timestamp' }, { status: 400 })
    }

    const lastSyncedAt = getLastSyncedAt()
    const latest = await getLatestRunVerdict()
    if (!latest) {
      return NextResponse.json({ ready: false, reason: 'no activities', synced: false, lastSyncedAt })
    }

    const { activity, verdict, generatedAt } = latest
    const readiness = verdictReadiness({ lastSyncedAt, generatedAt, hasVerdict: verdict !== null }, since)

    return NextResponse.json({
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
        url: `${req.nextUrl.origin}/activities/${activity.id}`,
      },
      // Only ever the verdict that was asked for. Handing back the previous
      // run's card on a poll that is still waiting invites a shortcut to
      // notify with it, and makes "headline has a value" a sound ready test
      // for a client that cannot match a JSON boolean cleanly.
      verdict: readiness.ready ? verdict : null,
    })
  })
}

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
 * `synced` is reported alongside `ready` so a poll that never finishes can say
 * which half of the chain it is stuck on: an app still serving pre-sync data,
 * or a live deployment whose run has not been written up yet.
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

/** `null` when absent, `'invalid'` when it is not a timestamp we can compare. */
export function sinceParam(req: NextRequest): number | null | 'invalid' {
  const raw = req.nextUrl.searchParams.get('since')
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

/** Without a `since` to measure against, whatever is stored counts as current. */
function isAfter(timestamp: string | null, since: number | null): boolean {
  if (timestamp === null) return false
  if (since === null) return true

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) && parsed > since
}
