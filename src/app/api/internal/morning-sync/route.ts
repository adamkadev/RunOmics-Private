import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { dispatchSync, readSyncGate, syncConfig } from '@/lib/githubSync'
import { loadData } from '@/application/usecases/LoadData'
import { getHealthHistory } from '@/application/usecases/GetLoadRecovery'

/** A quick sync once the athlete is up, for one who sleeps with a tracker: the nightly sync runs before the night ends. */
export const { GET, POST } = scheduledRoute('morning-sync', async () => {
  await loadData()
  if (getHealthHistory().length === 0) return NextResponse.json({ skipped: 'no overnight tracker' })

  const config = syncConfig(process.env)
  if ('missing' in config) {
    return NextResponse.json({ error: `Sync is not configured: ${config.missing.join(', ')} unset` }, { status: 503 })
  }

  const gate = await readSyncGate(config)
  if (gate.kind === 'running') return NextResponse.json({ skipped: 'a sync is already running', since: gate.since })

  // No operator push here: the nightly route already sends one for a refused dispatch, and this one costs a morning.
  const dispatched = await dispatchSync(config, 'quick')
  if (!dispatched.ok) return NextResponse.json({ error: `GitHub refused the dispatch (${dispatched.status})` }, { status: 502 })
  return NextResponse.json({ dispatched: true, profile: config.profile ?? 'all' })
})
