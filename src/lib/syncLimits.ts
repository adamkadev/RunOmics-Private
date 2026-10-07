/**
 * How often the app may start the Garmin sync (design review, Oct 2026). A
 * manual sync dispatches a GitHub Actions workflow, so it is limited on the
 * server - a PWA's own button can be bypassed. The numbers are proposals,
 * kept here to tune. The nightly run is never limited.
 */
export const SYNC_LIMITS = {
  /** No new manual sync this soon after one that succeeded... */
  cooldownAfterSuccessMs: 10 * 60_000,
  /** ...nor this soon after one that failed, so a retry can follow a fix. */
  cooldownAfterFailureMs: 2 * 60_000,
  /** Manual syncs in a rolling 24 hours: rolling, so no time zone decides "today". */
  dailyCap: 12,
  dailyWindowMs: 24 * 3600_000,
} as const

/** A sync workflow run, as GitHub's runs list gives it. */
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
  /** A run for this athlete is already going: wait on it rather than start a second. */
  | { kind: 'running'; since: string }
  | { kind: 'cooldown'; retryAfterSec: number }
  | { kind: 'dailyCap'; retryAfterSec: number }
  | { kind: 'open' }

/**
 * Whether a run syncs this athlete. One workflow serves both deployments, so
 * each run's name ends with the profile it covers, "(all)" for both; a run
 * from before the name carried it is counted as both.
 */
export function syncsProfile(run: Pick<SyncRun, 'display_title'>, profile: string | null): boolean {
  if (profile === null) return true
  const named = /\(([^()]+)\)\s*$/.exec(run.display_title)?.[1]
  return !named || named === 'all' || named === profile
}

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000))

/** What a new manual sync may do now, from the workflow's recent runs. */
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
