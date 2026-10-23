import { describe, expect, it } from 'vitest'
import { parseSince, verdictReadiness } from '../verdictStatus'

const DISPATCHED_AT = Date.parse('2026-09-19T21:04:07Z')

describe('parseSince', () => {
  it('reads the dispatch time the shortcut stamps onto every poll', () => {
    expect(parseSince('2026-09-19T21:04:07Z')).toBe(DISPATCHED_AT)
  })

  it('treats an absent since as no baseline rather than as zero', () => {
    expect(parseSince(null)).toBeNull()
  })

  it('survives the unencoded + Shortcuts puts in a local-time offset', () => {
    // `...T23:04:07+02:00` reaches the query parser as `...T23:04:07 02:00`.
    expect(parseSince('2026-09-19T23:04:07 02:00')).toBe(DISPATCHED_AT)
    expect(parseSince('2026-09-19T23:04:07 0200')).toBe(DISPATCHED_AT)
  })

  it('rejects a since it cannot compare, instead of silently answering ready', () => {
    expect(parseSince('yesterday')).toBe('invalid')
    expect(parseSince('')).toBe('invalid')
  })
})

describe('verdictReadiness', () => {
  it('is ready once a verdict has been written since the shortcut asked', () => {
    expect(
      verdictReadiness(
        {
          lastSyncedAt: '2026-09-19T21:06:15.650488+00:00',
          generatedAt: '2026-09-19T21:08:59Z',
          hasVerdict: true,
        },
        DISPATCHED_AT
      )
    ).toEqual({ ready: true, synced: true })
  })

  it('holds while the previous deployment answers, verdict and all', () => {
    // The five minutes this endpoint exists for: the app still serves yesterday's run and its card.
    expect(
      verdictReadiness(
        {
          lastSyncedAt: '2026-09-19T02:56:03Z',
          generatedAt: '2026-09-19T03:00:00Z',
          hasVerdict: true,
        },
        DISPATCHED_AT
      )
    ).toEqual({
      ready: false,
      synced: false,
      reason: 'waiting for the deployment carrying this sync',
    })
  })

  it('separates the live-but-unwritten wait from the pre-sync one', () => {
    expect(
      verdictReadiness(
        { lastSyncedAt: '2026-09-19T21:06:15Z', generatedAt: null, hasVerdict: false },
        DISPATCHED_AT
      )
    ).toEqual({ ready: false, synced: true, reason: 'no verdict for this run yet' })
  })

  it('holds when a sync brought no new run, so the newest card is still the old one', () => {
    // A sync that changes nothing still redeploys to refresh the timestamp, so
    // `synced` alone would call an untouched card ready.
    expect(
      verdictReadiness(
        {
          lastSyncedAt: '2026-09-19T21:06:15Z',
          generatedAt: '2026-09-18T03:00:00Z',
          hasVerdict: true,
        },
        DISPATCHED_AT
      )
    ).toEqual({ ready: false, synced: true, reason: 'verdict predates this sync' })
  })

  it('never calls a missing verdict ready, whatever the timestamps say', () => {
    expect(
      verdictReadiness(
        { lastSyncedAt: '2026-09-19T21:06:15Z', generatedAt: '2026-09-19T21:08:59Z', hasVerdict: false },
        DISPATCHED_AT
      ).ready
    ).toBe(false)
  })

  it('answers with whatever is stored when asked without a baseline', () => {
    expect(
      verdictReadiness(
        { lastSyncedAt: '2026-09-19T02:56:03Z', generatedAt: '2026-09-19T03:00:00Z', hasVerdict: true },
        null
      )
    ).toEqual({ ready: true, synced: true })
  })

  it('is not ready before the first sync has ever run', () => {
    expect(verdictReadiness({ lastSyncedAt: null, generatedAt: null, hasVerdict: false }, null)).toEqual({
      ready: false,
      synced: false,
      reason: 'waiting for the deployment carrying this sync',
    })
  })
})
