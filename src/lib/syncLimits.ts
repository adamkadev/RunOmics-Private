/** Enforced on the server: a PWA's own button can be bypassed. */
export const SYNC_LIMITS = {
  cooldownAfterSuccessMs: 10 * 60_000,
  /** Shorter, so a retry can follow a fix. */
  cooldownAfterFailureMs: 2 * 60_000,
  /** Per rolling 24 hours, so no time zone decides "today". */
  dailyCap: 12,
  dailyWindowMs: 24 * 3600_000,
} as const

/** As GitHub's workflow runs API returns it. */
export interface SyncRun {
  status: string
  conclusion: string | null
  event: string
  created_at: string
  updated_at: string
  /** "Sync Garmin Activities (adam)": the run-name carries the profile it syncs. */
  display_title: string
}

export type SyncGate =
  | { kind: 'running'; since: string }
  | { kind: 'cooldown'; retryAfterSec: number }
  | { kind: 'dailyCap'; retryAfterSec: number }
  | { kind: 'open' }

/** One workflow serves both deployments: a run named "(all)", or with no profile in its name, syncs both. */
export function syncsProfile(run: Pick<SyncRun, 'display_title'>, profile: string | null): boolean {
  if (profile === null) return true
  const named = /\(([^()]+)\)\s*$/.exec(run.display_title)?.[1]
  return !named || named === 'all' || named === profile
}

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000))

export function syncGate(runs: readonly SyncRun[], profile: string | null, now: number): SyncGate {
  const mine = runs.filter((run) => syncsProfile(run, profile))

  const running = mine.filter((run) => run.status !== 'completed').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (running) return { kind: 'running', since: running.created_at }

  const manual = mine.filter((run) => run.event === 'workflow_dispatch')
  const today = manual.filter((run) => now - Date.parse(run.created_at) < SYNC_LIMITS.dailyWindowMs)
  if (today.length >= SYNC_LIMITS.dailyCap) {
    const oldest = Math.min(...today.map((run) => Date.parse(run.created_at)))
    return { kind: 'dailyCap', retryAfterSec: seconds(oldest + SYNC_LIMITS.dailyWindowMs - now) }
  }

  const last = manual.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
  if (last) {
    const wait = last.conclusion === 'success' ? SYNC_LIMITS.cooldownAfterSuccessMs : SYNC_LIMITS.cooldownAfterFailureMs
    const until = Date.parse(last.updated_at) + wait
    if (now < until) return { kind: 'cooldown', retryAfterSec: seconds(until - now) }
  }
  return { kind: 'open' }
}
