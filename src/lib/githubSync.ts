import 'server-only'
import { SYNC_LIMITS, syncGate, type SyncGate, type SyncRun } from '@/lib/syncLimits'

export interface SyncConfig {
  repo: string
  workflow: string
  ref: string
  token: string
  profile: string | null
}

/** Quick: the Sync button's new runs only. Nightly: everything, gear and token checks included. */
export type SyncMode = 'quick' | 'nightly'

export function syncConfig(env: NodeJS.ProcessEnv): SyncConfig | { missing: string[] } {
  const missing = (['GITHUB_SYNC_TOKEN', 'GITHUB_SYNC_REPO'] as const).filter((key) => !env[key])
  if (missing.length) return { missing }

  return {
    repo: env.GITHUB_SYNC_REPO!,
    // A file name rather than a numeric id: it survives the workflow being deleted and recreated.
    workflow: env.GITHUB_SYNC_WORKFLOW || 'sync.yml',
    ref: env.GITHUB_SYNC_REF || 'main',
    token: env.GITHUB_SYNC_TOKEN!,
    // One deployment is one athlete, so a dispatch syncs that athlete, not the whole matrix.
    profile: env.GITHUB_SYNC_PROFILE || null,
  }
}

export function dispatchBody(config: SyncConfig, mode: SyncMode) {
  return {
    ref: config.ref,
    inputs: { [mode]: 'true', ...(config.profile ? { profile: config.profile } : {}) },
  }
}

const GITHUB_HEADERS = (token: string) => ({
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28',
})

/** GitHub's run list is the record; an unreadable one lets the sync through, as the workflow's concurrency serializes. */
export async function readSyncGate(config: SyncConfig, now = Date.now()): Promise<SyncGate> {
  const since = new Date(now - SYNC_LIMITS.dailyWindowMs).toISOString().replace(/\.\d{3}Z$/, 'Z')
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.repo}/actions/workflows/${config.workflow}/runs?per_page=50&created=${encodeURIComponent(`>=${since}`)}`,
      { headers: GITHUB_HEADERS(config.token), cache: 'no-store' }
    )
    if (!response.ok) {
      console.error('[sync-dispatch] could not list runs', response.status)
      return { kind: 'open' }
    }
    const { workflow_runs: runs = [] } = (await response.json()) as { workflow_runs?: SyncRun[] }
    return syncGate(runs, config.profile, now)
  } catch (error) {
    console.error('[sync-dispatch] could not list runs', error)
    return { kind: 'open' }
  }
}

/** GitHub's refusal body is logged, never returned: it can name the repository and the workflow. */
export async function dispatchSync(config: SyncConfig, mode: SyncMode): Promise<{ ok: true } | { ok: false; status: number }> {
  const response = await fetch(`https://api.github.com/repos/${config.repo}/actions/workflows/${config.workflow}/dispatches`, {
    method: 'POST',
    headers: { ...GITHUB_HEADERS(config.token), 'content-type': 'application/json' },
    body: JSON.stringify(dispatchBody(config, mode)),
  })
  if (response.ok) return { ok: true }

  console.error('[sync-dispatch] github said', response.status, await response.text())
  return { ok: false, status: response.status }
}
