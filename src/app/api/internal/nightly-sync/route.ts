import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { dispatchSync, readSyncGate, syncConfig } from '@/lib/githubSync'

/** Each deployment dispatches its own athlete's full sync; the button's cooldown and daily cap throttle taps, not this. */
export const { GET, POST } = scheduledRoute('nightly-sync', async () => {
  const config = syncConfig(process.env)
  if ('missing' in config) {
    return NextResponse.json({ error: `Sync is not configured: ${config.missing.join(', ')} unset` }, { status: 503 })
  }

  const gate = await readSyncGate(config)
  if (gate.kind === 'running') return NextResponse.json({ skipped: 'a sync is already running', since: gate.since })

  const dispatched = await dispatchSync(config, 'nightly')
  if (!dispatched.ok) {
    return NextResponse.json({ error: `GitHub refused the dispatch (${dispatched.status})` }, { status: 502 })
  }
  return NextResponse.json({ dispatched: true, profile: config.profile ?? 'all' })
})
