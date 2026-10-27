import { describe, expect, it } from 'vitest'
import { healthProblems } from '../check_deployment_health.mjs'

const NOW = Date.parse('2026-10-27T14:47:00Z')
const HEALTHY = {
  status: 'ok',
  lastSyncedAt: '2026-10-27T01:20:00Z',
  integrations: { firebaseAdmin: true, gemini: true, syncButton: true, cron: true, privateSite: true, routing: true },
}

describe('healthProblems', () => {
  it('finds none in a deployment that synced last night', () => {
    expect(healthProblems(200, HEALTHY, NOW)).toEqual([])
  })

  it('flags one missed nightly sync, which the app itself reports only after three', () => {
    expect(healthProblems(200, { ...HEALTHY, lastSyncedAt: '2026-10-26T01:20:00Z' }, NOW)).toEqual([
      'the last sync landed 37 h ago (2026-10-26T01:20:00Z)',
    ])
  })

  it('flags a stale deployment that answered 503 by its sync time', () => {
    expect(healthProblems(503, { ...HEALTHY, status: 'stale', lastSyncedAt: '2026-10-20T01:00:00Z' }, NOW)).toEqual([
      'the last sync landed 182 h ago (2026-10-20T01:00:00Z)',
    ])
  })

  it('flags a deployment with no sync recorded or an unreadable one', () => {
    expect(healthProblems(503, { ...HEALTHY, lastSyncedAt: null }, NOW)).toEqual(['no sync has been recorded'])
    expect(healthProblems(503, { ...HEALTHY, lastSyncedAt: 'soon' }, NOW)).toEqual(['no sync has been recorded'])
  })

  it('flags data that will not load, naming the refused commit', () => {
    expect(healthProblems(503, { status: 'unloaded', dataCommit: null, rejectedData: { commit: 'abc1234', errors: [] } }, NOW)).toEqual([
      'the deployment could not load its data: it refused data commit abc1234',
    ])
    expect(healthProblems(503, { status: 'unloaded', dataCommit: null, rejectedData: null }, NOW)).toEqual([
      'the deployment could not load its data',
    ])
  })

  it('flags missing Firebase Admin or cron credentials, and only those', () => {
    const integrations = { ...HEALTHY.integrations, firebaseAdmin: false, cron: false, gemini: false, routing: false }
    expect(healthProblems(200, { ...HEALTHY, integrations }, NOW)).toEqual(['no credentials for: firebaseAdmin, cron'])
  })

  it('counts a deployment that does not report its cron credential as missing it', () => {
    const { cron: _, ...integrations } = HEALTHY.integrations
    expect(healthProblems(200, { ...HEALTHY, integrations }, NOW)).toEqual(['no credentials for: cron'])
  })

  it('names a refused secret, an answer that is no health report and any other failure', () => {
    expect(healthProblems(401, { error: 'Unauthorized' }, NOW)).toEqual(['health refused INTERNAL_NOTIFY_SECRET (401)'])
    expect(healthProblems(504, null, NOW)).toEqual(['health answered 504 without a health report'])
    expect(healthProblems(500, { error: 'Internal error' }, NOW)).toEqual(['health answered 500 without a health report'])
    expect(healthProblems(429, HEALTHY, NOW)).toEqual(['health answered 429'])
  })
})
