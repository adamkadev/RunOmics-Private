import { NextResponse, type NextRequest } from 'next/server'
import { handleOwnerRoute } from '@/lib/ownerRoute'
import { dispatchSync, readSyncGate, syncConfig } from '@/lib/githubSync'

/**
 * The GitHub token is a server env var the browser never sees, behind the owner claim, unlike the iOS shortcut's PAT,
 * which syncs to iCloud in plain text.
 */
export async function POST(req: NextRequest) {
  return handleOwnerRoute('sync-dispatch', req, async () => {
    const config = syncConfig(process.env)
    if ('missing' in config) {
      return NextResponse.json(
        { error: `Sync is not configured: ${config.missing.join(', ')} unset` },
        { status: 503 }
      )
    }

    const gate = await readSyncGate(config)
    // One run at a time: a second tap waits on the run already going, with
    // its start as the "since" the status poll reads verdicts against.
    if (gate.kind === 'running') return NextResponse.json({ since: gate.since, alreadyRunning: true })
    if (gate.kind === 'cooldown' || gate.kind === 'dailyCap') {
      return NextResponse.json(
        { error: gate.kind === 'cooldown' ? 'Synced moments ago' : 'Daily sync limit reached', reason: gate.kind, retryAfter: gate.retryAfterSec },
        { status: 429, headers: { 'retry-after': String(gate.retryAfterSec) } }
      )
    }

    // Stamped before the call, never after: a verdict written between the
    // dispatch and this timestamp would be read as this run's answer.
    const since = new Date().toISOString()

    const dispatched = await dispatchSync(config, 'quick')
    if (!dispatched.ok) {
      return NextResponse.json({ error: `GitHub refused the dispatch (${dispatched.status})` }, { status: 502 })
    }

    return NextResponse.json({ since })
  })
}
