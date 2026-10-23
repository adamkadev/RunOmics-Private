import { NextResponse, type NextRequest } from 'next/server'
import { handleOwnerRoute } from '@/lib/ownerRoute'
import { SYNC_LIMITS, syncGate, type SyncGate, type SyncRun } from '@/lib/syncLimits'

/**
 * The GitHub token is a server env var the browser never sees, behind the owner claim, unlike the iOS shortcut's PAT,
 * which syncs to iCloud in plain text.
 */

interface SyncConfig {
  repo: string
  workflow: string
  ref: string
  token: string
  profile: string | null
}

export function syncConfig(env: NodeJS.ProcessEnv): SyncConfig | { missing: string[] } {
  const missing = (['GITHUB_SYNC_TOKEN', 'GITHUB_SYNC_REPO'] as const).filter((key) => !env[key])
  if (missing.length) return { missing }

  return {
    repo: env.GITHUB_SYNC_REPO!,
    // A file name rather than a numeric id: it survives the workflow being
    // deleted and recreated, which changes the id and nothing else.
    workflow: env.GITHUB_SYNC_WORKFLOW || 'sync.yml',
    ref: env.GITHUB_SYNC_REF || 'main',
    token: env.GITHUB_SYNC_TOKEN!,
    // One deployment is one athlete, so a dispatch syncs that athlete, not the whole matrix.
    profile: env.GITHUB_SYNC_PROFILE || null,
  }
}

export function dispatchBody(config: SyncConfig) {
  return { ref: config.ref, inputs: { quick: 'true', ...(config.profile ? { profile: config.profile } : {}) } }
}

const GITHUB_HEADERS = (token: string) => ({
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28',
})

/**
 * GitHub keeps the record of runs, so no store of our own can drift from it. A list that cannot be read lets the sync
 * through: the workflow's per-profile concurrency still keeps two runs from overlapping.
 */
export async function readSyncGate(config: SyncConfig, now = Date.now()): Promise<SyncGate> {
  const since = new Date(now - SYNC_LIMITS.dailyWindowMs).toISOString().replace(/\.\d{3}Z$/, 'Z')
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.repo}/actions/workflows/${config.workflow}/runs?per_page=50&created=${encodeURIComponent(`>=${since}`)}`,
      { headers: GITHUB_HEADERS(config.token), cache: 'no-store' }
    )
    if (!response.ok) {
      console.error('[owner:sync-dispatch] could not list runs', response.status)
      return { kind: 'open' }
    }
    const { workflow_runs: runs = [] } = (await response.json()) as { workflow_runs?: SyncRun[] }
    return syncGate(runs, config.profile, now)
  } catch (error) {
    console.error('[owner:sync-dispatch] could not list runs', error)
    return { kind: 'open' }
  }
}

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

    const response = await fetch(
      `https://api.github.com/repos/${config.repo}/actions/workflows/${config.workflow}/dispatches`,
      {
        method: 'POST',
        headers: { ...GITHUB_HEADERS(config.token), 'content-type': 'application/json' },
        body: JSON.stringify(dispatchBody(config)),
      }
    )

    // 204 is the success case; anything else carries a body worth logging but
    // not worth returning, since it can name the repository and the workflow.
    if (!response.ok) {
      console.error('[owner:sync-dispatch] github said', response.status, await response.text())
      return NextResponse.json(
        { error: `GitHub refused the dispatch (${response.status})` },
        { status: 502 }
      )
    }

    return NextResponse.json({ since })
  })
}
