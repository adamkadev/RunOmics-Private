import { describe, expect, it } from 'vitest'
import { SYNC_LIMITS, syncGate, syncsProfile, type SyncRun } from '../syncLimits'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString()

function run(over: Partial<SyncRun> = {}): SyncRun {
  return { status: 'completed', conclusion: 'success', event: 'workflow_dispatch', created_at: ago(30), updated_at: ago(25), display_title: 'Sync Garmin Activities (adam)', ...over }
}

describe('syncsProfile', () => {
  // One workflow serves both deployments: each run names the profile it syncs.
  it("counts a run for this athlete or for all, never another athlete's", () => {
    expect(syncsProfile(run(), 'adam')).toBe(true)
    expect(syncsProfile(run({ display_title: 'Sync Garmin Activities (all)' }), 'adam')).toBe(true)
    expect(syncsProfile(run({ display_title: 'Sync Garmin Activities (lamiaa)' }), 'adam')).toBe(false)
    // A run from before the name carried the profile synced everyone.
    expect(syncsProfile(run({ display_title: 'Sync Garmin Activities' }), 'adam')).toBe(true)
    expect(syncsProfile(run({ display_title: 'Sync Garmin Activities (lamiaa)' }), null)).toBe(true)
  })
})

describe('syncGate', () => {
  it('waits on a run already going rather than starting a second', () => {
    expect(syncGate([run({ status: 'in_progress', conclusion: null, created_at: ago(2) })], 'adam', NOW)).toEqual({ kind: 'running', since: ago(2) })
    // The nightly run counts too: it syncs this athlete.
    expect(syncGate([run({ status: 'queued', conclusion: null, event: 'schedule', display_title: 'Sync Garmin Activities (all)' })], 'adam', NOW).kind).toBe('running')
    // Another athlete's run does not hold this one back.
    expect(syncGate([run({ status: 'in_progress', conclusion: null, display_title: 'Sync Garmin Activities (lamiaa)' })], 'adam', NOW).kind).toBe('open')
  })

  it('spaces manual syncs: 10 min after one that worked, 2 after one that failed', () => {
    expect(syncGate([run({ updated_at: ago(4) })], 'adam', NOW)).toEqual({ kind: 'cooldown', retryAfterSec: 6 * 60 })
    expect(syncGate([run({ updated_at: ago(11) })], 'adam', NOW).kind).toBe('open')
    expect(syncGate([run({ conclusion: 'failure', updated_at: ago(1) })], 'adam', NOW)).toEqual({ kind: 'cooldown', retryAfterSec: 60 })
    expect(syncGate([run({ conclusion: 'failure', updated_at: ago(3) })], 'adam', NOW).kind).toBe('open')
    // The nightly run is never what spaces a manual one.
    expect(syncGate([run({ event: 'schedule', updated_at: ago(1) })], 'adam', NOW).kind).toBe('open')
  })

  it(`caps manual syncs at ${SYNC_LIMITS.dailyCap} in a rolling day, until the oldest leaves it`, () => {
    const runs = Array.from({ length: SYNC_LIMITS.dailyCap }, (_, i) => run({ created_at: ago(60 * (i + 1)), updated_at: ago(60 * (i + 1) - 5) }))
    // The oldest is 12 h old: it leaves the window in 12 h.
    expect(syncGate(runs, 'adam', NOW)).toEqual({ kind: 'dailyCap', retryAfterSec: 12 * 3600 })
    expect(syncGate(runs.slice(1), 'adam', NOW).kind).toBe('open')
  })

  it('lets a sync through with nothing to hold it back', () => {
    expect(syncGate([], 'adam', NOW)).toEqual({ kind: 'open' })
  })
})
